const {defineConfig}=require('@playwright/test')
module.exports=defineConfig({testDir:'.',testMatch:'**/*.browser.cjs',timeout:30000,workers:1,use:{baseURL:'http://127.0.0.1:3000',browserName:'chromium',screenshot:'only-on-failure'},webServer:{command:'npm run start -- --hostname 127.0.0.1',port:3000,reuseExistingServer:false,timeout:60000},reporter:'list'})
