import { ref } from 'vue'

const isDark = ref(false)

export function useTheme() {
  const toggleTheme = () => {
    isDark.value = !isDark.value
    if (typeof window !== 'undefined') {
      const html = document.documentElement
      if (isDark.value) {
        html.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        html.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }
  }

  const initTheme = () => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme')
      // Default to light mode (white-light blue style) as requested
      if (savedTheme === 'dark') {
        isDark.value = true
        document.documentElement.classList.add('dark')
      } else {
        isDark.value = false
        document.documentElement.classList.remove('dark')
      }
    }
  }

  return {
    isDark,
    toggleTheme,
    initTheme
  }
}
