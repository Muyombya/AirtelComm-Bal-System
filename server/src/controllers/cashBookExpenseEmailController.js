import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { pool } from "../config/database.js";

function validMonth(value){const month=String(value||"").trim();if(!/^\d{4}-\d{2}$/.test(month)){const e=new Error("Month must use YYYY-MM format.");e.statusCode=400;throw e;}return month;}
function branchFilter(value){const raw=String(value??"").trim().toLowerCase();if(raw==="all"||raw==="")return null;if(raw==="company")return "company";const id=Number(raw);if(!Number.isInteger(id)||id<=0){const e=new Error("Branch ID must be a valid branch, COMPANY, or ALL.");e.statusCode=400;throw e;}return id;}
function recipients(value){return String(value||"").split(/[;,]/).map(x=>x.trim()).filter(Boolean);}
function money(value){return `UGX ${Number(value||0).toLocaleString("en-UG")}`;}

async function buildReport(branchInput,monthInput){
  const branchId=branchFilter(branchInput),month=validMonth(monthInput),start=`${month}-01`;
  const nextMonth=(await pool.query(`SELECT (date_trunc('month',$1::date)+INTERVAL '1 month')::date AS next_month`,[start])).rows[0].next_month;
  let branch={id:null,name:"All Branches + Company"};
  if(typeof branchId==="number"){const r=await pool.query(`SELECT id,name FROM branches WHERE id=$1`,[branchId]);if(!r.rowCount){const e=new Error("Branch not found.");e.statusCode=404;throw e;}branch=r.rows[0];}
  else if(branchId==="company")branch={id:null,name:"Company / Central"};
  let where,params;
  if(branchId===null){where=`business_date >= $1 AND business_date < $2 AND entry_type='EXPENSE'`;params=[start,nextMonth];}
  else if(branchId==="company"){where=`expense_scope='COMPANY' AND business_date >= $1 AND business_date < $2 AND entry_type='EXPENSE'`;params=[start,nextMonth];}
  else{where=`branch_id=$1 AND business_date >= $2 AND business_date < $3 AND entry_type='EXPENSE'`;params=[branchId,start,nextMonth];}
  const summary=(await pool.query(`SELECT COALESCE(SUM(amount) FILTER (WHERE expense_scope='BRANCH'),0) branch_expenses,COALESCE(SUM(amount) FILTER (WHERE expense_scope='COMPANY'),0) company_expenses,COALESCE(SUM(amount),0) expenses,COUNT(*)::INT entries FROM cash_book_entries WHERE ${where}`,params)).rows[0]||{};
  const categories=(await pool.query(`SELECT COALESCE(NULLIF(TRIM(category),''),'Other') category,SUM(amount) amount,COUNT(*)::INT entries FROM cash_book_entries WHERE ${where} GROUP BY COALESCE(NULLIF(TRIM(category),''),'Other') ORDER BY COUNT(*) DESC,SUM(amount) DESC,category ASC`,params)).rows;
  const daily=(await pool.query(`SELECT business_date,SUM(amount) amount,COUNT(*)::INT entries FROM cash_book_entries WHERE ${where} GROUP BY business_date ORDER BY business_date DESC`,params)).rows;
  const branches=branchId==="company"?[]:(await pool.query(`SELECT b.id,b.name,COALESCE(SUM(c.amount),0) expenses,COUNT(c.id)::INT entries FROM branches b LEFT JOIN cash_book_entries c ON c.branch_id=b.id AND c.entry_type='EXPENSE' AND c.expense_scope='BRANCH' AND c.business_date >= $1 AND c.business_date < $2 GROUP BY b.id,b.name ORDER BY expenses DESC,b.name ASC`,[start,nextMonth])).rows;
  const company=(await pool.query(`SELECT COALESCE(SUM(amount),0) amount,COUNT(*)::INT entries FROM cash_book_entries WHERE entry_type='EXPENSE' AND expense_scope='COMPANY' AND business_date >= $1 AND business_date < $2`,[start,nextMonth])).rows[0]||{};
  const fundsWhere=branchId===null?`branch_id IS NOT NULL AND business_date >= $1 AND business_date < $2`:branchId==="company"?`1=0`:`branch_id=$1 AND business_date >= $2 AND business_date < $3`;
  const fundsParams=branchId===null?[start,nextMonth]:branchId==="company"?[]:[branchId,start,nextMonth];
  const funds=(await pool.query(`SELECT COALESCE(SUM(amount),0) amount FROM cash_book_entries WHERE entry_type='TOP_UP' AND ${fundsWhere}`,fundsParams)).rows[0]||{};
  const entries=(await pool.query(`SELECT c.id,c.branch_id,b.name branch_name,c.business_date,c.expense_scope,c.category,c.description,c.amount FROM cash_book_entries c LEFT JOIN branches b ON b.id=c.branch_id WHERE ${where} ORDER BY c.business_date DESC,c.entered_at DESC,c.id DESC`,params)).rows;
  const branchCategoryWhere=branchId===null?`business_date >= $1 AND business_date < $2 AND entry_type='EXPENSE' AND expense_scope='BRANCH'`:`branch_id=$1 AND business_date >= $2 AND business_date < $3 AND entry_type='EXPENSE' AND expense_scope='BRANCH'`;
  const branchCategoryParams=branchId===null?[start,nextMonth]:[branchId,start,nextMonth];
  const branchCategories=(branchId==='company'?[]:(await pool.query(`SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,SUM(amount)::NUMERIC(18,2) AS amount,COUNT(*)::INT AS entries FROM cash_book_entries WHERE ${branchCategoryWhere} GROUP BY COALESCE(NULLIF(TRIM(category),''),'Other') ORDER BY COUNT(*) DESC,SUM(amount) DESC,category ASC`,branchCategoryParams)).rows);
  const fundsAdded=Number(funds.amount||0),expenses=Number(summary.expenses||0);
  const mostFrequentBranchExpense=branchCategories.length?{category:branchCategories[0].category,entries:Number(branchCategories[0].entries),amount:Number(branchCategories[0].amount)}:null;
  const highestBranchExpense=branchCategories.length?[...branchCategories].sort((a,b)=>Number(b.amount)-Number(a.amount)||Number(b.entries)-Number(a.entries)||String(a.category).localeCompare(String(b.category)))[0]:null;
  return {branch,month,summary:{fundsAdded,expenses,netMovement:fundsAdded-expenses,branchExpenses:Number(summary.branch_expenses||0),companyExpenses:Number(summary.company_expenses||0),combinedExpenses:expenses},categories:categories.map(x=>({category:x.category,amount:Number(x.amount),entries:Number(x.entries)})),daily:daily.map(x=>({businessDate:String(x.business_date).slice(0,10),amount:Number(x.amount),entries:Number(x.entries)})),branches:branches.map(x=>({name:x.name,expenses:Number(x.expenses),entries:Number(x.entries)})),company:{amount:Number(company.amount||0),entries:Number(company.entries||0)},highlights:{mostFrequentBranchExpense,highestBranchExpense},entries:entries.map(x=>({businessDate:String(x.business_date).slice(0,10),business_date:String(x.business_date).slice(0,10),branchName:x.branch_name||null,expenseScope:x.expense_scope,category:x.category||"Other",description:x.description||null,amount:Number(x.amount)}))};
}

function makePdf(report){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:42});
    const chunks=[];
    doc.on("data",c=>chunks.push(c));
    doc.on("end",()=>resolve(Buffer.concat(chunks)));
    doc.on("error",reject);

    const left=42, right=553, width=right-left;
    const navy="#0f172a", slate="#475569", muted="#64748b", line="#dbe3ec", darkLine="#334155", soft="#f8fafc";
    const moneyText=value=>money(value);

    function rule(y,color=line,thickness=0.7){
      doc.moveTo(left,y).lineTo(right,y).lineWidth(thickness).strokeColor(color).stroke();
    }

    function sectionTitle(title){
      doc.moveDown(.35);
      doc.font("Helvetica-Bold").fontSize(9.2).fillColor(slate).text(title.toUpperCase(),left,doc.y,{width,align:"center"});
      const y=doc.y+5;
      rule(y,darkLine,1.3);
      doc.y=y+7;
    }

    function statementRow(label,value,opts={}){
      const y=doc.y;
      const h=opts.height||22;
      if(opts.topRule)rule(y,"#94a3b8",.8);
      if(opts.background){doc.rect(left,y,width,h).fill(opts.background);}
      doc.font(opts.bold?"Helvetica-Bold":"Helvetica").fontSize(opts.size||9.2).fillColor(navy)
        .text(label,left+7,y+6,{width:300});
      doc.font(opts.bold?"Helvetica-Bold":"Helvetica").fontSize(opts.size||9.2).fillColor(navy)
        .text(String(value??""),left+310,y+6,{width:width-317,align:"right"});
      if(opts.border!==false)rule(y+h,"#e2e8f0",.55);
      doc.y=y+h;
    }

    function twoColumnTable(headers,rows,widths){
      const y=doc.y;
      const headerH=23;
      doc.rect(left,y,width,headerH).fill("#f8fafc");
      let x=left;
      headers.forEach((h,i)=>{
        doc.font("Helvetica-Bold").fontSize(7.4).fillColor(muted).text(h,x+7,y+7,{width:widths[i]-14,align:i===headers.length-1?"right":"left"});
        x+=widths[i];
      });
      doc.y=y+headerH;
      rule(doc.y,line,.6);
      rows.forEach(row=>{
        const h=24;
        const ry=doc.y;
        let xx=left;
        row.forEach((v,i)=>{
          const align=(i===headers.length-1?"right":"left");
          doc.font(i===0?"Helvetica":"Helvetica").fontSize(8.7).fillColor(slate).text(String(v??""),xx+7,ry+7,{width:widths[i]-14,align});
          xx+=widths[i];
        });
        rule(ry+h,line,.45);
        doc.y=ry+h;
      });
    }

    function findingsTable(rows){
      const widths=[235,234];
      const y=doc.y, h=23;
      doc.rect(left,y,width,h).fill(soft);
      doc.font("Helvetica-Bold").fontSize(7.4).fillColor(muted).text("FINDING",left+7,y+7,{width:widths[0]-14});
      doc.font("Helvetica-Bold").fontSize(7.4).fillColor(muted).text("RESULT",left+widths[0]+7,y+7,{width:widths[1]-14,align:"right"});
      doc.y=y+h; rule(doc.y,line,.6);
      rows.forEach(row=>{
        const rh=32, ry=doc.y;
        doc.font("Helvetica").fontSize(8.8).fillColor(slate).text(row[0],left+7,ry+9,{width:widths[0]-14});
        doc.font("Helvetica-Bold").fontSize(8.8).fillColor(navy).text(row[1],left+widths[0]+7,ry+9,{width:widths[1]-14,align:"right"});
        rule(ry+rh,line,.45); doc.y=ry+rh;
      });
    }

    function detailTable(rows){
      const widths=[75,112,91,142,91];
      const headers=["DATE","SCOPE / BRANCH","CATEGORY","DESCRIPTION","AMOUNT"];
      const y=doc.y, hh=23;
      doc.rect(left,y,width,hh).fill(soft);
      let x=left;
      headers.forEach((h,i)=>{
        doc.font("Helvetica-Bold").fontSize(7.1).fillColor(muted).text(h,x+7,y+7,{width:widths[i]-14,align:i===4?"right":"left"}); x+=widths[i];
      });
      doc.y=y+hh; rule(doc.y,line,.7);
      rows.forEach(row=>{
        const rh=28, ry=doc.y;
        let xx=left;
        row.forEach((v,i)=>{
          doc.font(i===4?"Helvetica-Bold":"Helvetica").fontSize(8.3).fillColor(i===4?navy:slate).text(String(v??""),xx+7,ry+8,{width:widths[i]-14,align:i===4?"right":"left"});
          xx+=widths[i];
        });
        rule(ry+rh,line,.45); doc.y=ry+rh;
      });
    }

    // Header — centered to match the locally printed report.
    doc.font("Helvetica-Bold").fontSize(9).fillColor(slate).text("AIRTEL COMMUNICATIONS",left,42,{width,align:"center",characterSpacing:.7});
    doc.font("Helvetica").fontSize(17).fillColor(navy).text(`${report.branch.name.toUpperCase()} CASH BOOK EXPENDITURE REPORT`,left,61,{width,align:"center"});
    doc.font("Helvetica").fontSize(9.5).fillColor(muted).text("Monthly expenditure and cash control statement",left,85,{width,align:"center"});

    // Metadata strip — centered content in each column.
    const metaY=108, metaH=53, metaW=width/3;
    doc.rect(left,metaY,width,metaH).fill("#f8fafc").strokeColor(line).stroke();
    const meta=[
      ["REPORTING MONTH",report.month],
      ["BRANCH / SCOPE",report.branch.name],
      ["REPORT TYPE","MONTHLY EXPENDITURE"]
    ];
    meta.forEach((m,i)=>{
      const x=left+i*metaW;
      if(i>0)doc.moveTo(x,metaY).lineTo(x,metaY+metaH).strokeColor(line).stroke();
      doc.font("Helvetica-Bold").fontSize(6.8).fillColor(muted).text(m[0],x+12,metaY+12,{width:metaW-24,align:"center",characterSpacing:.45});
      doc.font("Helvetica-Bold").fontSize(9.2).fillColor(navy).text(m[1],x+12,metaY+29,{width:metaW-24,align:"center"});
    });

    const statusY=metaY+metaH;
    doc.rect(left,statusY,width,28).fill("#eef2f7").strokeColor(line).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(slate).text("MONTHLY EXPENDITURE REPORT",left,statusY+10,{width,align:"center",characterSpacing:.45});
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor(muted).text("READ-ONLY REPORT",left,statusY+10,{width,align:"center"});
    doc.y=statusY+38;

    sectionTitle("MONTHLY CASH BOOK POSITION");
    statementRow("POSITION","AMOUNT",{bold:true,size:7.5,background:soft});
    statementRow("Funds Added",moneyText(report.summary.fundsAdded));
    statementRow("Branch Expenses",moneyText(report.summary.branchExpenses));
    statementRow("Company / Central Expenses",moneyText(report.summary.companyExpenses));
    statementRow("Combined Expenditure",moneyText(report.summary.combinedExpenses),{bold:true,topRule:true});
    statementRow("Net Movement",moneyText(report.summary.netMovement),{bold:true,background:soft,border:false});
    doc.y+=9;

    sectionTitle("KEY BRANCH EXPENSE FINDINGS");
    const findingRows=[];
    if(report.highlights?.highestBranchExpense){
      const x=report.highlights.highestBranchExpense;
      findingRows.push(["Highest Branch Expense by Amount",`${x.category} · ${moneyText(x.amount)} · ${x.entries} entries`]);
    }
    if(report.highlights?.mostFrequentBranchExpense){
      const x=report.highlights.mostFrequentBranchExpense;
      findingRows.push(["Most Frequent Branch Expense",`${x.category} · ${x.entries} entries · ${moneyText(x.amount)}`]);
    }
    if(findingRows.length) findingsTable(findingRows);
    else {doc.font("Helvetica").fontSize(8.8).fillColor(slate).text("No branch expense recorded",left+7,doc.y+8);doc.y+=25;}
    doc.y+=9;

    if(report.branch.name === "All Branches + Company") {
      sectionTitle("EXPENSES BY BRANCH");
      twoColumnTable(["BRANCH","ENTRIES","EXPENDITURE"],[...report.branches.map(x=>[x.name,x.entries,moneyText(x.expenses)]),["Company / Central",report.company.entries,moneyText(report.company.amount)]],[270,75,166]);
      doc.y+=9;
    }

    sectionTitle("EXPENSE BY CATEGORY");
    twoColumnTable(["CATEGORY","ENTRIES","AMOUNT"],report.categories.map(x=>[x.category,x.entries,moneyText(x.amount)]),[270,75,166]);
    doc.y+=9;

    sectionTitle("DAILY EXPENDITURE");
    twoColumnTable(["DATE","ENTRIES","DAILY TOTAL"],report.daily.map(x=>[new Date(`${String(x.businessDate || x.business_date || "").slice(0,10)}T00:00:00`).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"2-digit"}).replace(",",""),x.entries,moneyText(x.amount)]),[270,75,166]);

    // The local print places detailed expenditure on page 2.
    doc.addPage();
    sectionTitle("DETAILED EXPENDITURE");
    detailTable(report.entries.map(x=>[
      new Date(`${String(x.businessDate || x.business_date || "").slice(0,10)}T00:00:00`).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"2-digit"}).replace(",",""),
      x.expenseScope==="COMPANY"?"Company / Central":x.branchName||"Branch",
      x.category||"Other",
      x.description||"—",
      moneyText(x.amount)
    ]));

    const footerY=735;
    rule(footerY,line,.7);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(muted).text("AIRTEL COMMUNICATIONS",left,footerY+16,{width:150});
    doc.font("Helvetica-Bold").fontSize(7).fillColor(muted).text("CASH BOOK EXPENDITURE REPORT",left+165,footerY+16,{width:180,align:"center"});
    doc.font("Helvetica-Bold").fontSize(7).fillColor(muted).text(report.month,left+390,footerY+16,{width:121,align:"right"});

    doc.end();
  });
}

export async function emailMonthlyExpenseReport(req,res,next){
  try{
    const to=recipients(req.body.to),cc=recipients(req.body.cc),subject=String(req.body.subject||"").trim(),message=String(req.body.message||"").trim();
    if(!to.length){const e=new Error("At least one recipient in To is required.");e.statusCode=400;throw e;}
    if(!subject){const e=new Error("Subject is required.");e.statusCode=400;throw e;}
    const report=await buildReport(req.body.branchId,req.body.month),pdf=await makePdf(report);
    const host=String(process.env.SMTP_HOST||"").trim(),port=Number(process.env.SMTP_PORT||587),secure=String(process.env.SMTP_SECURE||"false").toLowerCase()==="true",user=String(process.env.SMTP_USER||"").trim(),password=String(process.env.SMTP_PASSWORD||""),from=String(process.env.SMTP_FROM||user).trim();
    if(!host||!user||!password||!from){const e=new Error("Email service is not configured.");e.statusCode=503;throw e;}
    const transporter=nodemailer.createTransport({host,port,secure,auth:{user,pass:password}});
    const safeBranch=report.branch.name.replace(/[^a-z0-9]+/gi,"-");
    await transporter.sendMail({from,to,cc:cc.length?cc:undefined,subject,text:message||`Please find attached the Cash Book Expenditure Report for ${report.branch.name} for ${report.month}.`,attachments:[{filename:`Cash-Book-Expenditure-${safeBranch}-${report.month}.pdf`,content:pdf,contentType:"application/pdf"}]});
    res.json({message:"Cash Book Expenditure Report emailed successfully."});
  }catch(e){next(e);}
}
