import { createContext, useCallback, useContext, useState } from 'react'

const TransitionCtx = createContext(null)

export function TransitionProvider({ children }) {
  const [active, setActive] = useState(false)

  const trigger = useCallback((callback) => {
    setActive(true)
    setTimeout(() => {
      callback()
      setTimeout(() => setActive(false), 30)
    }, 180)
  }, [])

  return (
    <TransitionCtx.Provider value={trigger}>
      {children}
      <div className={`panel-overlay${active ? ' panel-overlay--in' : ''}`} aria-hidden="true" />
    </TransitionCtx.Provider>
  )
}

export const usePanelTransition = () => useContext(TransitionCtx)
