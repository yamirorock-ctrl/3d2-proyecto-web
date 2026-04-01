const fs = require('fs');
let t = fs.readFileSync('components/ProductAdmin.tsx', 'utf8');

// 1. Add Import
if (!t.includes('import { getMLConfig')) {
    t = t.replace("import { compressImage } from '../utils/imageCompression';", "import { compressImage } from '../utils/imageCompression';\nimport { getMLConfig, type MLConfig } from '../services/configService';");
}

// 2. Add useEffect is already there partially from my previous attempt? No, let's re-verify.
// I saw line 161 in previous successful chunk:
/*
  const [mlInstallments, setMlInstallments] = useState(3);
+  const [mlConfig, setMlConfig] = useState<MLConfig | null>(null);
+
+  useEffect(() => {
+    getMLConfig().then(res => setMlConfig(res));
+  }, []);
*/

// 3. Update useMemo logic
const oldMemo = `    const FREE_SHIPPING_THRESHOLD = 30000;
    const FIXED_FEE = publishedPrice < FREE_SHIPPING_THRESHOLD ? 2950 : 0;
    const CLASSIC_PERCENT = 0.1435;
    let cuotasMarkup = 0;
    if (mlInstallments === 3) cuotasMarkup = 0.09;
    else if (mlInstallments === 6) cuotasMarkup = 0.1488;
    else if (mlInstallments === 9) cuotasMarkup = 0.2035;
    else if (mlInstallments === 12) cuotasMarkup = 0.2333;
    const PREMIUM_PERCENT = CLASSIC_PERCENT + cuotasMarkup;
    const EST_SHIPPING = publishedPrice >= FREE_SHIPPING_THRESHOLD ? 10122 : 0;`;

const newMemo = `    const FREE_SHIPPING_THRESHOLD = mlConfig?.fixed_fee_threshold ?? 30000;
    const FIXED_FEE = publishedPrice < FREE_SHIPPING_THRESHOLD ? (mlConfig?.fixed_fee_unit ?? 2950) : 0;
    const CLASSIC_PERCENT = mlConfig?.classic_fee ?? 0.1435;
    let cuotasMarkup = 0;
    if (mlInstallments === 3) cuotasMarkup = mlConfig?.installment_3 ?? 0.09;
    else if (mlInstallments === 6) cuotasMarkup = mlConfig?.installment_6 ?? 0.1488;
    else if (mlInstallments === 9) cuotasMarkup = mlConfig?.installment_9 ?? 0.2035;
    else if (mlInstallments === 12) cuotasMarkup = mlConfig?.installment_12 ?? 0.2333;
    const PREMIUM_PERCENT = CLASSIC_PERCENT + cuotasMarkup;
    const EST_SHIPPING = publishedPrice >= FREE_SHIPPING_THRESHOLD ? (mlConfig?.shipping_cost ?? 10122) : 0;`;

if (t.includes(oldMemo)) {
    t = t.replace(oldMemo, newMemo);
} else if (t.includes(oldMemo.replace(/\n/g, '\r\n'))) {
    t = t.replace(oldMemo.replace(/\n/g, '\r\n'), newMemo.replace(/\n/g, '\r\n'));
}

// 4. Update dependencies
t = t.replace('}, [form.price, mlMarkup, mlInstallments]);', '}, [form.price, mlMarkup, mlInstallments, mlConfig]);');
t = t.replace('}, [form.price, mlMarkup, mlInstallments]);'.replace(/\n/g, '\r\n'), '}, [form.price, mlMarkup, mlInstallments, mlConfig]);'.replace(/\n/g, '\r\n'));

fs.writeFileSync('components/ProductAdmin.tsx', t);
console.log('ProductAdmin updated successfully');
