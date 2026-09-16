import ConfiguratorBuilder from '../../../components/ConfiguratorBuilder'
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}){
  const query=await searchParams
  return <ConfiguratorBuilder slug="custom-dcdb" title="Build your DCDB." code="DCDB" assetPreview={query.preview==='components-v1'}/>
}
