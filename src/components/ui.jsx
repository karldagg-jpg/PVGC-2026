import { G, M, GOLD, CREAM, FB } from "../constants/theme";

const Tag=({children,color=M})=>(
  <span style={{fontSize:"8px",letterSpacing:"0.14em",textTransform:"uppercase",
    background:color+"18",color,border:`1px solid ${color}55`,borderRadius:"2px",padding:"2px 8px",
    fontFamily:"'Cormorant SC',Georgia,serif",fontWeight:600}}>
    {children}
  </span>
);

const PtsBadge=({pts})=>{
  if(pts===null||pts===undefined) return <span style={{color:M,fontSize:"13px",fontFamily:"'Cormorant Garamond',Georgia,serif"}}>–</span>;
  const color=pts>=3?"#6aaa72":pts===1?"#f0e16a":pts===0?"#6a7a5a":"#c0392b";
  return <span style={{display:"inline-block",minWidth:"24px",textAlign:"center",
    fontWeight:700,fontSize:"15px",color,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.02em"}}>{pts}</span>;
};

const ScoreInput=({value,onChange,disabled})=>(
  <input type="number" min="1" max="15"
    value={value===0?"":value} placeholder="–" disabled={disabled}
    onChange={e=>onChange(parseInt(e.target.value)||0)}
    style={{width:"46px",borderRadius:"6px",textAlign:"center",padding:"5px 3px",
      fontFamily:FB,fontSize:"14px",outline:"none",
      background:disabled?"rgba(26,61,36,0.04)":"rgba(255,255,255,0.7)",
      border:`1px solid ${GOLD}44`,color:disabled?M:CREAM}}/>
);

const NavBtn=({children,active,onClick})=>(
  <button onClick={onClick} style={{
    padding:"10px 16px",borderRadius:"0",border:"none",
    borderBottom:active?`3px solid ${G}`:"3px solid transparent",
    background:active?G+"15":"transparent",
    color:active?G:"#2a3a2a",
    fontFamily:FB,fontSize:"13px",letterSpacing:"0.08em",textTransform:"uppercase",
    cursor:"pointer",fontWeight:active?700:500,transition:"all 0.15s",whiteSpace:"nowrap"
  }}>{children}</button>
);


export { Tag, PtsBadge, ScoreInput, NavBtn };
