const fs = require('fs');
let t = fs.readFileSync('components/ProductAdmin.tsx', 'utf8');

const tOldComms = `    const CLASSIC_PERCENT = 0.165;
    let cuotasMarkup = 0;
    if (mlInstallments === 3) cuotasMarkup = 0.0928;
    else if (mlInstallments === 6) cuotasMarkup = 0.1488;
    else if (mlInstallments === 9) cuotasMarkup = 0.2035;
    else if (mlInstallments === 12) cuotasMarkup = 0.2333;`;

const tNewComms = `    const CLASSIC_PERCENT = 0.1435; // Cargo Base
    let cuotasMarkup = 0;
    if (mlInstallments === 3) cuotasMarkup = 0.09;
    else if (mlInstallments === 6) cuotasMarkup = 0.1488;
    else if (mlInstallments === 9) cuotasMarkup = 0.2035;
    else if (mlInstallments === 12) cuotasMarkup = 0.2333;`;

t = t.replace(tOldComms, tNewComms);
t = t.replace(tOldComms.replace(/\n/g, '\r\n'), tNewComms.replace(/\n/g, '\r\n'));


const tOldJSX = `                          <p className="text-[10px] text-slate-500 flex justify-between">
                             <span>Cargo por vender (16.5%):</span>
                             <span className="font-bold text-rose-400">-\${mlProjection.classic.breakdown.comm.toLocaleString('es-AR')}</span>
                          </p>`;

const tNewJSX = `                          <p className="text-[10px] text-slate-500 flex justify-between">
                             <span>Cargo por vender (Clásico):</span>
                             <span className="font-bold text-rose-400">-\${mlProjection.classic.breakdown.comm.toLocaleString('es-AR')}</span>
                          </p>`;

t = t.replace(tOldJSX, tNewJSX);
t = t.replace(tOldJSX.replace(/\n/g, '\r\n'), tNewJSX.replace(/\n/g, '\r\n'));

const tOldPreJSX = `                          <p className="text-[10px] text-slate-500 flex justify-between">
                             <span>Cargo por vender <select className="ml-1 text-[10px] bg-transparent border-b border-rose-300 py-0 pl-0 pr-4 focus:ring-0 w-24" value={mlInstallments} onChange={e=>setMlInstallments(Number(e.target.value))}><option value={3}>3 cuotas</option><option value={6}>6 cuotas</option><option value={9}>9 cuotas</option><option value={12}>12 cuotas</option></select>:</span>
                             <span className="font-bold text-rose-400">-\${(mlProjection.premium.breakdown.comm + mlProjection.premium.breakdown.cuotas).toLocaleString('es-AR')}</span>
                          </p>`;

const tNewPreJSX = `                          <p className="text-[10px] text-slate-500 flex justify-between">
                             <span>Cargo por vender:</span>
                             <span className="font-bold text-rose-400">-\${mlProjection.premium.breakdown.comm.toLocaleString('es-AR')}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 flex justify-between mt-1">
                             <span>Costo por ofrecer cuotas <select className="ml-1 text-[10px] bg-transparent border-b border-rose-300 py-0 pl-0 pr-2 focus:ring-0 w-20" value={mlInstallments} onChange={e=>setMlInstallments(Number(e.target.value))}><option value={3}>3 cuotas</option><option value={6}>6 cuotas</option><option value={9}>9 cuotas</option><option value={12}>12 cuotas</option></select>:</span>
                             <span className="font-bold text-rose-400">-\${mlProjection.premium.breakdown.cuotas.toLocaleString('es-AR')}</span>
                          </p>`;

t = t.replace(tOldPreJSX, tNewPreJSX);
t = t.replace(tOldPreJSX.replace(/\n/g, '\r\n'), tNewPreJSX.replace(/\n/g, '\r\n'));

fs.writeFileSync('components/ProductAdmin.tsx', t);
console.log('Done script.');
