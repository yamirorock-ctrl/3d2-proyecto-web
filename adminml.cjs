const fs = require('fs');
let content = fs.readFileSync('components/ProductAdmin.tsx', 'utf8');
let lines = content.split('\n');

let start = -1;
let end = -1;

for (let i = 400; i < 600; i++) {
    if (lines[i] && lines[i].includes('{/* Simulador de Costos ML (New!) */}')) start = i;
    if (start > -1 && i > start && lines[i] && lines[i].includes('                )}')) {
        end = i;
    }
    if (start > -1 && i > start && lines[i] && lines[i].includes('{/* Campos Dinámicos según Categoría */}')) {
        break;
    }
}

if (start > -1 && end > -1) {
    let optStart = -1;
    for (let i = 1300; i < lines.length; i++) {
        if (lines[i] && lines[i].includes('Optimización para Venta')) {
            optStart = i;
            break;
        }
    }
    
    if (optStart > -1) {
        let blockLines = lines.splice(start, end - start + 1);
        let blockText = blockLines.join('\n');
        
        // customize blockText
        blockText = blockText.replace('<span>Cargo por vender (35%):</span>', '<span>Cargo por vender <select className=\"ml-1 text-[10px] bg-transparent border-b border-rose-300 py-0 pl-0 pr-4 focus:ring-0 w-24\" value={mlInstallments} onChange={e=>setMlInstallments(Number(e.target.value))}><option value={3}>3 cuotas</option><option value={6}>6 cuotas</option><option value={9}>9 cuotas</option><option value={12}>12 cuotas</option></select>:</span>');
        blockText = blockText.replace('-${mlProjection.premium.breakdown.comm.toLocaleString(\'es-AR\')}', '-${(mlProjection.premium.breakdown.comm + mlProjection.premium.breakdown.cuotas).toLocaleString(\'es-AR\')}');
        
        let inject = '          <div className=\"sm:col-span-2 border-t pt-4 mt-0\">\n             <h4 className=\"font-semibold text-slate-800 mb-2 flex items-center gap-2\">\n                 <span className=\"bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs\">MercadoLibre</span>\n                 Simulador de Rentabilidad\n             </h4>\n';
        inject += blockText + '\n          </div>\n';
        
        // Re-find target because we spliced the array!
        let newOptStart = -1;
        for (let i = 800; i < lines.length; i++) {
            if (lines[i] && lines[i].includes('Optimización para Venta')) {
                newOptStart = i;
                break;
            }
        }
        
        lines.splice(newOptStart - 2, 0, inject);
        fs.writeFileSync('components/ProductAdmin.tsx', lines.join('\n'));
        console.log('Successfully completed final migration step. Moved from ' + start + ' to ' + (newOptStart - 2));
    } else {
        console.log('Could not find Optimización target');
    }
} else {
    console.log('Error', start, end);
}
