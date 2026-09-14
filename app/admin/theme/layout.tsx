import ThemeLogoManager from '../../../components/admin/ThemeLogoManager'
import './theme-logo.css'

export default function ThemeLayout({children}:{children:React.ReactNode}){
  return <><ThemeLogoManager/>{children}</>
}
