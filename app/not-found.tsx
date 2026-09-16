import {SearchX} from 'lucide-react'
import StoreHeader from '../components/StoreHeader'
import StoreFooter from '../components/StoreFooter'
import {BuyerEmptyState} from '../components/buyer/BuyerUI'

export default function NotFound(){
 return <><StoreHeader/><main className="container" style={{paddingBlock:40}}><BuyerEmptyState icon={<SearchX size={26}/>} eyebrow="404" title="This page could not be found." description="The product, page or link may have moved. Continue with the catalogue or return to the New India Solar homepage." primary={{label:'Browse products',href:'/shop'}} secondary={{label:'Return home',href:'/'}}/></main><StoreFooter/></>
}
