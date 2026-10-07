// Real HTTP smoke checks against a frontend launched WITHOUT Supabase env.
const checks=[
 {path:'/',method:'GET',status:200},
 {path:'/api/proxy/groups',method:'GET',status:401},
 {path:'/api/auth',method:'POST',origin:'https://other.example',status:403},
 {path:'/api/auth',method:'POST',origin:'http://localhost:3000',status:503},
];
for(const check of checks){
 const response=await fetch('http://localhost:3000'+check.path,{method:check.method,headers:{'Content-Type':'application/json',...(check.origin?{Origin:check.origin}:{})},...(check.method==='POST'?{body:JSON.stringify({action:'login',email:'test@example.com',password:'local-test-only'})}:{})});
 if(response.status!==check.status)throw Error(`${check.path}: expected ${check.status}, got ${response.status}`);
 console.log(check.method,check.path,response.status);
}
