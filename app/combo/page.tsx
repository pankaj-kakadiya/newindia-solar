import type {Metadata} from 'next'
import StoreHeader from '../../components/StoreHeader'
import StoreFooter from '../../components/StoreFooter'
import ComboBuilder from '../../components/buyer/ComboBuilder'

export const metadata:Metadata={title:'ACDB + DCDB Combo | New India Solar',description:'Choose compatible published ACDB and DCDB products, set project quantities and add both protection boxes to one cart.',alternates:{canonical:'/combo'}}
export default function ComboPage(){return <><StoreHeader/><ComboBuilder/><StoreFooter/></>}
