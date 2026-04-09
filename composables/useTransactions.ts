import { ref, onUnmounted } from 'vue'
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDocs
} from 'firebase/firestore'
import type { UpiTransaction } from '~/types/transaction'

export function useTransactions() {
    const { $db, $auth } = useNuxtApp() as any
    const transactions = ref<UpiTransaction[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    let unsubscribe: (() => void) | null = null

    async function isDuplicate(
        transactionId: string,
        amount: number,
        merchantName: string,
        transactionDate: string
    ): Promise<boolean> {
        const uid = $auth.currentUser?.uid
        if (!uid) return false

        if (transactionId) {
            const q = query(
                collection($db, 'transactions'),
                where('userId', '==', uid),
                where('transactionId', '==', transactionId)
            )
            const snap = await getDocs(q)
            if (!snap.empty) return true
        }

        if (amount && merchantName && transactionDate) {
            const q = query(
                collection($db, 'transactions'),
                where('userId', '==', uid),
                where('amount', '==', amount),
                where('merchantName', '==', merchantName),
                where('transactionDate', '==', transactionDate)
            )
            const snap = await getDocs(q)
            if (!snap.empty) return true
        }

        return false
    }

    async function saveTransaction(
        txn: Omit<UpiTransaction, 'id' | 'createdAt'>
    ): Promise<string> {
        isLoading.value = true
        error.value = null

        try {
            const duplicate = await isDuplicate(
                txn.transactionId,
                txn.amount,
                txn.merchantName,
                txn.transactionDate
            )
            if (duplicate) {
                throw new Error('This transaction has already been saved.')
            }

            const col = collection($db, 'transactions')
            const docRef = await addDoc(col, {
                ...txn,
                createdAt: Date.now(),
                serverTimestamp: serverTimestamp()
            })
            return docRef.id
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to save'
            throw e
        } finally {
            isLoading.value = false
        }
    }

    function startListening() {
        const uid = $auth.currentUser?.uid
        if (!uid) return

        const q = query(
            collection($db, 'transactions'),
            where('userId', '==', uid),
            orderBy('createdAt', 'desc')
        )

        unsubscribe = onSnapshot(q, snap => {
            transactions.value = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as UpiTransaction))
        })
    }

    onUnmounted(() => unsubscribe?.())

    return { transactions, isLoading, error, saveTransaction, startListening, isDuplicate }
}
