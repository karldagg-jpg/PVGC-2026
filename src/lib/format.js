function fmtDate(str){
  if(!str) return "";
  const d=new Date(str+"T12:00:00");
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}

export { fmtDate };
