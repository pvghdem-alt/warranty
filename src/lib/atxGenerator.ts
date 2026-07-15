import templateJson from './atxTemplate.json';

export interface VendorInfo {
  company: string;
  address: string;
  zipCode: string;
}

export interface IssueInfo {
  vendorCompany?: string;
  name: string;
  notifyDate: string;
  waitDays: number | string;
}

export interface ProjectATXParams {
  projectName: string;
  vendors: VendorInfo[];
  issues: IssueInfo[];
}

const CHINESE_NUMS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
function getChineseNumber(num: number): string {
  return CHINESE_NUMS[num] || num.toString();
}

const FULLWIDTH_NUMS = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
function getFullWidthNumber(num: number): string {
  return num.toString().split('').map(c => FULLWIDTH_NUMS[parseInt(c)] || c).join('');
}

export function generateATX(params: ProjectATXParams): Blob {
  const { projectName, vendors, issues } = params;

  // Clone template
  const templateObj = JSON.parse(JSON.stringify(templateJson));

  // Update recipients in data-original
  templateObj.draftsHtml.draftHtml.forEach((draft: any) => {
    if (draft.html) {
      const match = draft.html.match(/data-original="(.*?)"/);
      if (match) {
        let origStr = match[1].replace(/&quot;/g, '"');
        let origObj;
        try {
          origObj = JSON.parse(origStr);
          const baseRecipient = origObj.recipients[0] || {};
          origObj.recipients = vendors.map((v, i) => ({
            ...baseRecipient,
            id: i + 1,
            no: i + 1,
            address: v.address,
            recipientFullName: v.company,
            outgoingMappingName: v.company,
            zip: v.zipCode
          }));
          let newOrigStr = JSON.stringify(origObj).replace(/"/g, '&quot;');
          draft.html = draft.html.replace(match[1], newOrigStr);
        } catch (e) {
          console.error("Failed to parse data-original JSON", e);
        }
      }
    }
  });

  let templateStr = JSON.stringify(templateObj);

  // Generate subject and description
  const subject = `有關貴公司承攬本院「${projectName}」保固缺失尚未修繕完妥，請依契約規定限期於文到次日起7日內改善完妥，請查照。`;
  const desc1 = `依據本院「${projectName}」契約書辦理。`;
  
  let desc2 = '';
  if (issues.length === 1) {
    desc2 = `查本院於先前已通知貴公司辦理保固維修（缺失項目：${issues[0].name}），惟迄今尚未修繕完妥。`;
  } else {
    // Group issues by vendor
    const vendorIssuesMap = new Map<string, IssueInfo[]>();
    
    // Default vendor if not specified (for backward compatibility or single vendor)
    const defaultVendor = vendors.length > 0 ? vendors[0].company : '貴公司';
    
    issues.forEach(iss => {
      const vComp = iss.vendorCompany || defaultVendor;
      if (!vendorIssuesMap.has(vComp)) {
        vendorIssuesMap.set(vComp, []);
      }
      vendorIssuesMap.get(vComp)!.push(iss);
    });

    const vendorGroups = Array.from(vendorIssuesMap.entries());
    
    if (vendorGroups.length === 1 && vendorGroups[0][0] === defaultVendor && vendors.length <= 1) {
       // Single vendor, multiple issues. Use simple numbering 1, 2, 3 but with ATX paragraphs
       desc2 = `查本院於先前已通知貴公司辦理保固維修如下，惟迄今尚未修繕完妥：</span></p>`;
       vendorGroups[0][1].forEach((iss, iIdx) => {
         const iNum = getFullWidthNumber(iIdx + 1);
         desc2 += `<p data-atfontfamily="標楷體" data-atfontsize="16" data-atlineheight="150%" data-atpaddingtop="0" data-atparagraphstartindent="64" data-attextindent="-32" data-atparagraphlevel="2" data-atrootdefinition="0" data-atrowspacing="0"><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="1" data-ateditinguser="">${iNum}、</span><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="0" data-ateditinguser="">${iss.name} (通知日：${iss.notifyDate}，已等待：${iss.waitDays}天)</span></p>`;
       });
       desc2 += `<p style="display:none;"><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="0" data-ateditinguser="">`;
    } else {
       // Multiple vendors, group by vendor with (一) then 1、
       desc2 = `查本院於先前已通知貴公司辦理保固維修如下，惟迄今尚未修繕完妥：</span></p>`;
       vendorGroups.forEach(([vComp, vIssues], vIdx) => {
         const vNum = getChineseNumber(vIdx + 1);
         desc2 += `<p data-atfontfamily="標楷體" data-atfontsize="16" data-atlineheight="150%" data-atpaddingtop="0" data-atparagraphstartindent="64" data-attextindent="-32" data-atparagraphlevel="2" data-atrootdefinition="0" data-atrowspacing="0"><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="1" data-ateditinguser="">(${vNum})</span><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="0" data-ateditinguser="">${vComp}，未處理工單${vIssues.length}件，詳細說明如次：</span></p>`;
         
         vIssues.forEach((iss, iIdx) => {
           const iNum = getFullWidthNumber(iIdx + 1);
           desc2 += `<p data-atfontfamily="標楷體" data-atfontsize="16" data-atlineheight="150%" data-atpaddingtop="0" data-atparagraphstartindent="80" data-attextindent="-32" data-atparagraphlevel="3" data-atrootdefinition="0" data-atrowspacing="0"><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="1" data-ateditinguser="">${iNum}、</span><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="0" data-ateditinguser="">${iss.name} (通知日：${iss.notifyDate}，已等待：${iss.waitDays}天)</span></p>`;
         });
       });
       desc2 += `<p style="display:none;"><span data-ateditingmode="readWrite" data-atisheader="0" data-atisserial="0" data-ateditinguser="">`;
    }
  }

  const desc3 = `請貴公司於文到次日起7日內派員修繕完妥，若逾期未處理，本院將依契約規定動用保固金逕行改善，衍生費用將由貴公司負擔。`;

  // Get current date for the document (ROC Date)
  const date = new Date();
  const rocYear = date.getFullYear() - 1911;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = `中華民國${rocYear}年${month}月${day}日`;
  const noStr = `${rocYear}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}001`;

  const escapeJsonStr = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
  const vendorNames = vendors.map(v => v.company).join('、');
  
  templateStr = templateStr.replace(/__VENDOR_COMPANY__/g, escapeJsonStr(vendorNames));
  templateStr = templateStr.replace(/__VENDOR_ADDRESS__/g, '');
  templateStr = templateStr.replace(/__VENDOR_ZIP__/g, '');
  templateStr = templateStr.replace(/__SUBJECT__/g, escapeJsonStr(subject));
  templateStr = templateStr.replace(/__DESC_1__/g, escapeJsonStr(desc1));
  templateStr = templateStr.replace(/__DESC_2__/g, escapeJsonStr(desc2));
  templateStr = templateStr.replace(/__DESC_3__/g, escapeJsonStr(desc3));
  templateStr = templateStr.replace(/__DATE__/g, escapeJsonStr(dateStr));
  templateStr = templateStr.replace(/__NO__/g, escapeJsonStr(noStr));

  return new Blob([templateStr], { type: 'application/json' });
}

export function downloadATX(params: ProjectATXParams) {
  const blob = generateATX(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const title = params.issues.length === 1 ? params.issues[0].name : '多項缺失';
  a.download = `催告函_${params.vendors.map(v => v.company).join('_')}_${title}.atx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
