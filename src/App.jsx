import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Link } from 'react-router-dom'
import Toolbar from './Toolbar.jsx'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <main>
      <Toolbar />

    </main>
    
    </>
  )
}



export default App
