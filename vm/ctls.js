/* Controles e cenários do simulador — fonte única da projeção e do celular */
const CTLS=[
 {t:'seg',k:'modo',lab:'Modo',ops:[['VCV','VCV'],['PCV','PCV'],['O2','Suporte O₂']]},
 {t:'seg',k:'disp',lab:'Dispositivo',ops:[['ar','Ar'],['cn','Cateter'],['vtx','Venturi'],['mnr','MNR'],['vni','VNI']],so:'O2'},
 {t:'r',k:'vc',lab:'Volume corrente',min:200,max:800,step:10,un:'mL',no:'O2',mo:'VCV'},
 {t:'r',k:'fluxo',lab:'Fluxo inspiratório',min:15,max:80,step:.5,un:'L/min',no:'O2',mo:'VCV'},
 {t:'r',k:'dp',lab:'ΔP acima da PEEP',min:5,max:35,step:1,un:'cmH₂O',mo:'PCV'},
 {t:'r',k:'ti',lab:'Tempo inspiratório',min:.4,max:1.6,step:.05,un:'s',mo:'PCV'},
 {t:'r',k:'fr',lab:'Frequência',min:6,max:35,step:1,un:'/min',no:'O2'},
 {t:'r',k:'peep',lab:'PEEP',min:0,max:20,step:1,un:'cmH₂O',no:'O2'},
 {t:'r',k:'fio2',lab:'FiO₂',min:.21,max:1,step:.01,un:'',no:'O2',pct:true},
 {t:'r',k:'lmin',lab:'Fluxo do cateter',min:1,max:6,step:1,un:'L/min',so:'O2',sd:'cn'},
 {t:'r',k:'vtx',lab:'Venturi',min:.24,max:.5,step:.01,un:'',so:'O2',sd:'vtx',pct:true},
 {t:'r',k:'mnr',lab:'Fluxo da máscara',min:10,max:15,step:1,un:'L/min',so:'O2',sd:'mnr'},
 {t:'r',k:'ps',lab:'Pressão de suporte',min:4,max:20,step:1,un:'cmH₂O',so:'O2',sd:'vni'},
 {t:'r',k:'epap',lab:'EPAP',min:0,max:14,step:1,un:'cmH₂O',so:'O2',sd:'vni'},
 {t:'r',k:'fio2',lab:'FiO₂',min:.21,max:1,step:.01,un:'',so:'O2',sd:'vni',pct:true},
 {t:'r',k:'frEsp',lab:'FR espontânea',min:10,max:40,step:1,un:'/min',so:'O2'},
 {t:'r',k:'C',lab:'Complacência',min:8,max:80,step:1,un:'mL/cmH₂O',cls:'fis'},
 {t:'r',k:'R',lab:'Resistência',min:3,max:45,step:.5,un:'cmH₂O/L/s',cls:'fis'},
 {t:'r',k:'shunt',lab:'Shunt',min:0,max:.5,step:.01,un:'%',cls:'fis',pct:true},
 {t:'r',k:'gasdur',lab:'Atraso da gasometria',min:0,max:60,step:5,un:'s',cls:'mon'},
 {t:'r',k:'pausa',lab:'Pausa inspiratória',min:0,max:2,step:.1,un:'s',no:'O2'},
 {t:'seg',k:'som',lab:'Som',ops:[['on','Ligado'],['off','Mudo']],cls:'mon'},
 {t:'r',k:'volVent',lab:'Volume do ventilador',min:0,max:1,step:.05,un:'',pct:true,cls:'mon'},
 {t:'r',k:'volMon',lab:'Volume do monitor (SpO₂)',min:0,max:1,step:.05,un:'',pct:true,cls:'mon'},
];

/* cenários (teclas 1–9 na tela · botões no celular) */
const CENAS=[
 ['1','Normal · VCV',           {modo:'VCV',C:55,R:8,shunt:.05,fio2:.4}],
 ['2','Pulmão duro · PCV',      {modo:'PCV',C:15,dp:24,shunt:.2}],
 ['3','Muito duro · PCV',       {modo:'PCV',C:10,dp:24,shunt:.3}],
 ['4','Broncoespasmo · R alta', {modo:'VCV',R:35.4,C:55,shunt:.05}],
 ['5','Ar ambiente',            {modo:'O2',disp:'ar',shunt:.30,C:30,frEsp:26}],
 ['6','Cateter nasal 4 L',      {modo:'O2',disp:'cn',lmin:4}],
 ['7','Venturi 0,35',           {modo:'O2',disp:'vtx',vtx:.35}],
 ['8','Não reinalante 15 L',    {modo:'O2',disp:'mnr',mnr:15,shunt:.30,C:30,frEsp:26}],
 ['9','VNI',                    {modo:'O2',disp:'vni',ps:10,epap:8,fio2:.6,C:30,shunt:.30,frEsp:26}],
];
if(typeof module!=='undefined') module.exports={CTLS,CENAS};
