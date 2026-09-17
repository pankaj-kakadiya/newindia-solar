export type CategoryPage={slug:string;label:string;categoryTerms:string[];description:string}

export const CATEGORY_PAGES:CategoryPage[]=[
 {slug:'acdb',label:'ACDB',categoryTerms:['acdb'],description:'AC distribution and protection boxes for residential, commercial and industrial solar installations.'},
 {slug:'dcdb',label:'DCDB',categoryTerms:['dcdb'],description:'DC combiner and protection boxes for solar strings and array-side protection.'},
 {slug:'enclosures',label:'Enclosures',categoryTerms:['enclosure','enclosures'],description:'IP-rated enclosures for solar distribution, protection and control assemblies.'},
 {slug:'mcb-mccb',label:'MCB / MCCB',categoryTerms:['mcb','mccb','mcbmccb','acmcb','dcmcb','acmccb','dcmccb'],description:'AC and DC circuit breakers for isolation and overcurrent protection.'},
 {slug:'spd',label:'Surge Protection Devices',categoryTerms:['spd','acspd','dcspd','surgeprotection','surgeprotectiondevice','surgeprotectiondevices'],description:'AC and DC surge protection devices for solar installations.'},
 {slug:'dc-fuses',label:'DC Fuses',categoryTerms:['fuse','fuses','dcfuse','dcfuses'],description:'DC fuse links and holders for photovoltaic protection applications.'},
 {slug:'solar-cable',label:'Solar Cable',categoryTerms:['solarcable','solarcables','cable'],description:'PV cable and internal wiring products for dependable solar installations.'},
 {slug:'mc4-connectors',label:'MC4 Connectors',categoryTerms:['mc4','mc4connector','mc4connectors'],description:'PV connectors and accessories for safe solar cable connections.'},
 {slug:'cable-glands',label:'Cable Glands',categoryTerms:['cablegland','cableglands'],description:'Sealed cable-entry products for solar enclosures and distribution boxes.'},
 {slug:'terminal-blocks',label:'Terminal Blocks',categoryTerms:['terminal','terminalblock','terminalblocks'],description:'Terminal blocks and internal connection systems for ACDB and DCDB assemblies.'},
 {slug:'earthing-kits',label:'Earthing Kits',categoryTerms:['earthing','earthingkit','earthingkits'],description:'Earthing components and project kits for solar installation safety.'},
 {slug:'bos-accessories',label:'BOS Accessories',categoryTerms:['bos','bosaccessories','balanceofsystem'],description:'Balance-of-system accessories that complete solar protection and installation projects.'},
]

export const categoryPage=(slug:string)=>CATEGORY_PAGES.find(category=>category.slug===slug)
