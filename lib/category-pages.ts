export type CategoryPage={slug:string;label:string;categoryTerms:string[];description:string;productSlugPrefix?:string;excludeSlugPrefix?:string}

export const COMBO_SLUG_PREFIX='acdb-dcdb-combo-'

export const CATEGORY_PAGES:CategoryPage[]=[
 {slug:'acdb-dcdb-combo',label:'ACDB + DCDB Combo',categoryTerms:['acdbdcdbcombo','combo'],productSlugPrefix:COMBO_SLUG_PREFIX,description:'Matched ACDB + DCDB box sets for 1–6 kW single phase rooftop solar — same-brand and mixed-brand combos, ready to dispatch.'},
 {slug:'acdb',label:'ACDB',categoryTerms:['acdb'],excludeSlugPrefix:COMBO_SLUG_PREFIX,description:'AC distribution and protection boxes for residential, commercial and industrial solar installations.'},
 {slug:'dcdb',label:'DCDB',categoryTerms:['dcdb'],excludeSlugPrefix:COMBO_SLUG_PREFIX,description:'DC combiner and protection boxes for solar strings and array-side protection.'},
]

export const CATEGORY_SLUGS=CATEGORY_PAGES.map(category=>category.slug)

export const categoryPage=(slug:string)=>CATEGORY_PAGES.find(category=>category.slug===slug)
