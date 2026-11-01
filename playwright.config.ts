import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,
 timeout:180000,expect:{timeout:30000},retries:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://localhost:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:375,height:812},isMobile:true,hasTouch:true}}],
 webServer:{command:`"${process.execPath}" scripts/run-framework.mjs dev --host 127.0.0.1`,url:'http://localhost:5173',reuseExistingServer:!process.env.CI,timeout:120000},
});
