import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import './index.css'
import Splash from './components/Splash'
import Cart from './pages/Cart'
import Fridge from './pages/Fridge'
import Landing from './pages/Landing'
import Meal from './pages/Meal'
import Onboarding from './pages/Onboarding'
import Plan from './pages/Plan'
import Profile from './pages/Profile'
import Swipe from './pages/Swipe'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/onboarding', element: <Onboarding /> },
  { path: '/frizider', element: <Fridge /> },
  { path: '/biram', element: <Swipe /> },
  { path: '/plan', element: <Plan /> },
  { path: '/obrok/:id', element: <Meal /> },
  { path: '/kosarica', element: <Cart /> },
  { path: '/profil', element: <Profile /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Splash />
  </StrictMode>,
)
