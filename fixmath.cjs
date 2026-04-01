const fs = require('fs');
let t = fs.readFileSync('components/ProductAdmin.tsx', 'utf8');
const search = `        const comm = Math.round(publishedPrice * percent);\n        const net = publishedPrice - comm - FIXED_FEE - EST_SHIPPING;\n        return {\n            publishedPrice,\n            net: Math.max(0, net),\n            fees: comm + FIXED_FEE,\n            breakdown: {\n                comm,\n                fixed: FIXED_FEE\n            },\n            shipping: EST_SHIPPING\n        };`;

const searchWin = search.replace(/\n/g, '\r\n');

const replace = `        const commBase = Math.round((publishedPrice * percent) - (publishedPrice * cuotasFeePercent));
        const commCuotas = Math.round(publishedPrice * cuotasFeePercent);
        const commTotal = Math.round(publishedPrice * percent);
        const net = publishedPrice - commTotal - FIXED_FEE - EST_SHIPPING;
        return {
            publishedPrice,
            net: Math.max(0, net),
            fees: commTotal + FIXED_FEE,
            breakdown: {
                comm: commBase,
                cuotas: commCuotas,
                fixed: FIXED_FEE
            },
            shipping: EST_SHIPPING
        };`;

if (t.includes(search)) {
    t = t.replace(search, replace);
    fs.writeFileSync('components/ProductAdmin.tsx', t);
    console.log('Success UNIX!');
} else if (t.includes(searchWin)) {
    t = t.replace(searchWin, replace.replace(/\n/g, '\r\n'));
    fs.writeFileSync('components/ProductAdmin.tsx', t);
    console.log('Success WIN!');
} else {
    console.log('Not found!');
}
