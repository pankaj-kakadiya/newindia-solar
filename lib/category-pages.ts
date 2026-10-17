export type CategoryPage={slug:string;label:string;seoTitle:string;categoryTerms:string[];description:string;productSlugPrefix?:string;excludeSlugPrefix?:string}

export const COMBO_SLUG_PREFIX='acdb-dcdb-combo-'

export const CATEGORY_PAGES:CategoryPage[]=[
 {slug:'acdb-dcdb-combo',label:'ACDB + DCDB Combo',seoTitle:'ACDB DCDB Combo Box for 1–6 kW Rooftop Solar | New India Solar',categoryTerms:['acdbdcdbcombo','combo'],productSlugPrefix:COMBO_SLUG_PREFIX,description:'Matched ACDB + DCDB box sets for 1–6 kW single phase rooftop solar — same-brand and mixed-brand combos, ready to dispatch.'},
 {slug:'acdb',label:'ACDB',seoTitle:'Solar ACDB Box – Single Phase, 1–6 kW | New India Solar',categoryTerms:['acdb'],excludeSlugPrefix:COMBO_SLUG_PREFIX,description:'Ready-wired single phase solar ACDB boxes for 1–6 kW rooftop systems, with AC MCB, SPD and terminal blocks. GST invoice and pan-India delivery.'},
 {slug:'dcdb',label:'DCDB',seoTitle:'Solar DCDB Box for 1–6 kW Rooftop Solar | New India Solar',categoryTerms:['dcdb'],excludeSlugPrefix:COMBO_SLUG_PREFIX,description:'Ready-wired solar DCDB boxes for 1–6 kW rooftop systems, with DC MCB or DC fuse, DC SPD and terminal blocks. GST invoice and pan-India delivery.'},
]

export const CATEGORY_SLUGS=CATEGORY_PAGES.map(category=>category.slug)

export const categoryPage=(slug:string)=>CATEGORY_PAGES.find(category=>category.slug===slug)
