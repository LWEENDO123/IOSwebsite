import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL JS STARTED");

const baseUrl="https://klenoboardinghouse-production.up.railway.app";

/* ============================
PARAMETERS
============================ */

const params=new URLSearchParams(window.location.search);

const houseId=params.get("id");
const university=params.get("university");
const studentId=params.get("student_id");

console.group("📌 PAGE PARAMETERS");
console.log("houseId:",houseId);
console.log("university:",university);
console.log("studentId:",studentId);
console.groupEnd();

/* ============================
HELPERS
============================ */

function showError(msg){
console.error("❌ ERROR:",msg);
alert(msg);
}

function validateParams(){

console.group("🔎 PARAM VALIDATION");

if(!houseId){
console.error("Missing houseId");
return false;
}

if(!university){
console.error("Missing university");
return false;
}

if(!studentId){
console.error("Missing studentId");
return false;
}

console.log("✅ Params OK");

console.groupEnd();

return true;
}

/* ============================
LOCATION
============================ */

function getCurrentLocation(){

console.log("📍 Getting location...");

return new Promise((resolve,reject)=>{

if(!navigator.geolocation){
reject("Geolocation unsupported");
return;
}

navigator.geolocation.getCurrentPosition(

(pos)=>{

console.log("📍 LOCATION SUCCESS");
console.log(pos.coords);

resolve({
lat:pos.coords.latitude,
lon:pos.coords.longitude
});

},

(err)=>{

console.error("❌ LOCATION ERROR",err);
reject(err.message);

}

);

});

}

/* ============================
REQUEST DEBUG
============================ */

async function debugRequest(url){

console.group("🌍 NETWORK REQUEST");
console.log("URL:",url);

try{

const res=await authorizedGet(url);

console.log("STATUS:",res.status);

const text=await res.text();

console.log("RAW RESPONSE:",text);

try{
const data=JSON.parse(text);
console.log("JSON:",data);
console.groupEnd();
return data;
}
catch(e){
console.error("❌ JSON parse failed");
console.groupEnd();
return null;
}

}catch(err){

console.error("❌ NETWORK ERROR",err);
console.groupEnd();
throw err;

}

}

/* ============================
PHONE
============================ */

async function callLandlordPhone(){

console.group("📞 PHONE CLICK");

if(!validateParams()) return;

const url=
`${baseUrl}/home/boardinghouse/${encodeURIComponent(houseId)}/landlord-phone`
+`?university=${encodeURIComponent(university)}`
+`&student_id=${encodeURIComponent(studentId)}`;

const data=await debugRequest(url);

if(data?.phone_number){

console.log("📞 Opening dialer:",data.phone_number);

window.location.href=`tel:${data.phone_number}`;

}else{

showError("Phone not available");

}

console.groupEnd();

}

/* ============================
GOOGLE
============================ */

async function openGoogleMaps(){

console.group("🗺 GOOGLE CLICK");

if(!validateParams()) return;

const {lat,lon}=await getCurrentLocation();

const url=
`${baseUrl}/home/google/${encodeURIComponent(houseId)}`
+`?university=${encodeURIComponent(university)}`
+`&student_id=${encodeURIComponent(studentId)}`
+`&current_lat=${lat}`
+`&current_lon=${lon}`;

const data=await debugRequest(url);

if(data?.link){

console.log("🗺 OPEN MAP:",data.link);

window.open(data.link,"_blank");

}else{

showError("Map link unavailable");

}

console.groupEnd();

}

/* ============================
YANGO
============================ */

async function openYango(){

console.group("🚗 YANGO CLICK");

if(!validateParams()) return;

const {lat,lon}=await getCurrentLocation();

const url=
`${baseUrl}/home/yango/${encodeURIComponent(houseId)}`
+`?university=${encodeURIComponent(university)}`
+`&student_id=${encodeURIComponent(studentId)}`
+`&current_lat=${lat}`
+`&current_lon=${lon}`;

const data=await debugRequest(url);

if(data?.deep_link){

console.log("🚗 Launch deep link");

window.location.href=data.deep_link;

}else if(data?.browser_link){

console.log("🚗 Launch browser link");

window.open(data.browser_link,"_blank");

}else{

showError("Yango unavailable");

}

console.groupEnd();

}

/* ============================
BIND BUTTONS
============================ */

document.addEventListener("DOMContentLoaded",()=>{

console.log("🔗 Binding buttons");

const phoneBtn=document.getElementById("phoneBtn");
const googleBtn=document.getElementById("googleBtn");
const yangoBtn=document.getElementById("yangoBtn");

console.log("Buttons:",{
phoneBtn,
googleBtn,
yangoBtn
});

phoneBtn?.addEventListener("click",callLandlordPhone);
googleBtn?.addEventListener("click",openGoogleMaps);
yangoBtn?.addEventListener("click",openYango);

});
