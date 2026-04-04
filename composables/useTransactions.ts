// composables/useTransactions.ts
import { ref, onUnmounted } from 'vue'
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore'
import type { UpiTransaction } from '~/types/transaction'

export function useTransactions() {
    const { $db, $auth } = useNuxtApp() as any
    const transactions = ref<UpiTransaction[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    let unsubscribe: (() => void) | null = null

    async function saveTransaction(
        txn: Omit<UpiTransaction, 'id' | 'createdAt'>
    ): Promise<string> {
        isLoading.value = true
        error.value = null

        try {
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

    return { transactions, isLoading, error, saveTransaction, startListening }
}