import ConfiguratorBuilder from '../../../components/ConfiguratorBuilder'
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}){
  const query=await searchParams
  return <ConfiguratorBuilder slug="custom-acdb" title="Build your ACDB." code="ACDB" assetPreview={query.preview==='components-v1'}/>
}
