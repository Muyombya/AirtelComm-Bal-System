import { pool } from "../config/database.js";

function validMonth(value) {
  const month = String(value || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) { const e = new Error("Month must use YYYY-MM format."); e.statusCode = 400; throw e; }
  return month;
}
function branchFilter(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "all" || raw === "") return null;
  if (raw === "company") return "company";
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) { const e = new Error("Branch ID must be a valid branch, COMPANY, or ALL."); e.statusCode = 400; throw e; }
  return id;
}
export async function getExpenseCategories(req,res,next){try{const r=await pool.query(`SELECT id,name FROM cash_book_expense_categories WHERE active=true ORDER BY id`);res.json(r.rows.map(x=>({...x,id:Number(x.id)})));}catch(e){next(e);}}

export async function getMonthlyExpenseReport(req,res,next){
  try {
    const branchId=branchFilter(req.query.branchId||"all");
    const month=validMonth(req.query.month||new Date().toISOString().slice(0,7));
    const start=`${month}-01`;
    const nextMonth=(await pool.query(`SELECT (date_trunc('month',$1::date)+INTERVAL '1 month')::date AS next_month`,[start])).rows[0].next_month;
    let branch={id:null,name:"All Branches + Company"};
    if(typeof branchId==='number'){
      const r=await pool.query(`SELECT id,name FROM branches WHERE id=$1`,[branchId]);
      if(!r.rowCount)return res.status(404).json({error:"Branch not found."}); branch=r.rows[0];
    } else if(branchId==='company') branch={id:null,name:"Company / Central"};

    let where,params;
    if(branchId===null){where=`business_date >= $1 AND business_date < $2 AND entry_type='EXPENSE'`;params=[start,nextMonth];}
    else if(branchId==='company'){where=`expense_scope='COMPANY' AND business_date >= $1 AND business_date < $2 AND entry_type='EXPENSE'`;params=[start,nextMonth];}
    else {where=`branch_id=$1 AND business_date >= $2 AND business_date < $3 AND entry_type='EXPENSE'`;params=[branchId,start,nextMonth];}

    const summary=await pool.query(`SELECT
      COALESCE(SUM(amount) FILTER (WHERE expense_scope='BRANCH'),0)::NUMERIC(18,2) AS branch_expenses,
      COALESCE(SUM(amount) FILTER (WHERE expense_scope='COMPANY'),0)::NUMERIC(18,2) AS company_expenses,
      COALESCE(SUM(amount),0)::NUMERIC(18,2) AS expenses, COUNT(*)::INT AS entries
      FROM cash_book_entries WHERE ${where}`,params);
    const categories=await pool.query(`SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,SUM(amount)::NUMERIC(18,2) AS amount,COUNT(*)::INT AS entries
      FROM cash_book_entries WHERE ${where} GROUP BY COALESCE(NULLIF(TRIM(category),''),'Other') ORDER BY COUNT(*) DESC,SUM(amount) DESC,category ASC`,params);
    const daily=await pool.query(`SELECT business_date,SUM(amount)::NUMERIC(18,2) AS amount,COUNT(*)::INT AS entries FROM cash_book_entries WHERE ${where}
      GROUP BY business_date ORDER BY business_date DESC`,params);
    const branches=await pool.query(`SELECT b.id,b.name,COALESCE(SUM(c.amount),0)::NUMERIC(18,2) AS expenses,COUNT(c.id)::INT AS entries
      FROM branches b LEFT JOIN cash_book_entries c ON c.branch_id=b.id AND c.entry_type='EXPENSE' AND c.expense_scope='BRANCH' AND c.business_date >= $1 AND c.business_date < $2
      GROUP BY b.id,b.name ORDER BY expenses DESC,b.name ASC`,[start,nextMonth]);
    const company=await pool.query(`SELECT COALESCE(SUM(amount),0)::NUMERIC(18,2) AS amount,COUNT(*)::INT AS entries
      FROM cash_book_entries WHERE entry_type='EXPENSE' AND expense_scope='COMPANY' AND business_date >= $1 AND business_date < $2`,[start,nextMonth]);
    const branchWhere=branchId===null?`business_date >= $1 AND business_date < $2`:`branch_id=$1 AND business_date >= $2 AND business_date < $3`;
    const branchParams=branchId===null?[start,nextMonth]:[branchId,start,nextMonth];
    const frequentBranch=branchId==='company'?{rows:[]}:(await pool.query(`SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,COUNT(*)::INT AS entries,SUM(amount)::NUMERIC(18,2) AS amount
      FROM cash_book_entries WHERE entry_type='EXPENSE' AND expense_scope='BRANCH' AND ${branchWhere} GROUP BY COALESCE(NULLIF(TRIM(category),''),'Other') ORDER BY COUNT(*) DESC,SUM(amount) DESC,category ASC LIMIT 1`,branchParams));
    const highestBranch=branchId==='company'?{rows:[]}:(await pool.query(`SELECT COALESCE(NULLIF(TRIM(category),''),'Other') AS category,COUNT(*)::INT AS entries,SUM(amount)::NUMERIC(18,2) AS amount
      FROM cash_book_entries WHERE entry_type='EXPENSE' AND expense_scope='BRANCH' AND ${branchWhere} GROUP BY COALESCE(NULLIF(TRIM(category),''),'Other') ORDER BY SUM(amount) DESC,COUNT(*) DESC,category ASC LIMIT 1`,branchParams));
    const entries=(await pool.query(`SELECT id,branch_id,business_date,entry_type,amount,category,description,entered_at,expense_scope FROM cash_book_entries WHERE ${where} ORDER BY business_date DESC,entered_at DESC,id DESC`,params)).rows;
    const fundsWhere=branchId===null?`branch_id IS NOT NULL AND business_date >= $1 AND business_date < $2`:branchId==='company'?`1=0`:`branch_id=$1 AND business_date >= $2 AND business_date < $3`;
    const fundsParams=branchId===null?[start,nextMonth]:branchId==='company'?[]:[branchId,start,nextMonth];
    const funds=(await pool.query(`SELECT COALESCE(SUM(amount),0)::NUMERIC(18,2) AS amount FROM cash_book_entries WHERE entry_type='TOP_UP' AND ${fundsWhere}`,fundsParams)).rows[0];
    const s=summary.rows[0]||{}; const fundsAdded=Number(funds?.amount||0), expenses=Number(s.expenses||0);
    res.json({branch,branchId,month,start,nextMonth,
      summary:{fundsAdded,expenses,netMovement:fundsAdded-expenses,branchExpenses:Number(s.branch_expenses||0),companyExpenses:Number(s.company_expenses||0),combinedExpenses:expenses,entries:Number(s.entries||0)},
      categories:categories.rows.map(x=>({category:x.category,amount:Number(x.amount),entries:Number(x.entries)})),
      daily:daily.rows.map(x=>({businessDate:String(x.business_date).slice(0,10),amount:Number(x.amount),entries:Number(x.entries)})),
      branches:branches.rows.map(x=>({id:Number(x.id),name:x.name,expenses:Number(x.expenses),entries:Number(x.entries)})),
      company:{amount:Number(company.rows[0]?.amount||0),entries:Number(company.rows[0]?.entries||0)},
      highlights:{mostFrequentBranchExpense:frequentBranch.rows[0]?{category:frequentBranch.rows[0].category,entries:Number(frequentBranch.rows[0].entries),amount:Number(frequentBranch.rows[0].amount)}:null,highestBranchExpense:highestBranch.rows[0]?{category:highestBranch.rows[0].category,entries:Number(highestBranch.rows[0].entries),amount:Number(highestBranch.rows[0].amount)}:null},
      entries:entries.map(x=>({...x,id:Number(x.id),branch_id:x.branch_id===null?null:Number(x.branch_id),amount:Number(x.amount),business_date:String(x.business_date).slice(0,10)}))});
  } catch(e){next(e);}
}


export async function getExpenseLedger(req,res,next){
  try {
    const branchId=branchFilter(req.query.branchId||"all");
    const month=validMonth(req.query.month||new Date().toISOString().slice(0,7));
    const requestedScope=String(req.query.scope||"ALL").trim().toUpperCase();
    if(!["ALL","BRANCH","COMPANY"].includes(requestedScope)){
      return res.status(400).json({error:"Scope must be ALL, BRANCH, or COMPANY."});
    }
    const start=`${month}-01`;
    const nextMonth=(await pool.query(`SELECT (date_trunc('month',$1::date)+INTERVAL '1 month')::date AS next_month`,[start])).rows[0].next_month;
    const params=[start,nextMonth];
    const conditions=[`c.entry_type='EXPENSE'`,`c.business_date >= $1`,`c.business_date < $2`];
    if(typeof branchId==='number'){
      if(requestedScope==='BRANCH') conditions.push(`c.expense_scope='BRANCH'`,`c.branch_id=$3`),params.push(branchId);
      else if(requestedScope==='COMPANY') conditions.push(`c.expense_scope='COMPANY'`);
      else conditions.push(`(c.expense_scope='COMPANY' OR (c.expense_scope='BRANCH' AND c.branch_id=$3))`),params.push(branchId);
    } else if(branchId==='company') {
      conditions.push(`c.expense_scope='COMPANY'`);
    } else {
      if(requestedScope==='BRANCH') conditions.push(`c.expense_scope='BRANCH'`);
      else if(requestedScope==='COMPANY') conditions.push(`c.expense_scope='COMPANY'`);
    }
    const where=conditions.join(' AND ');
    const rows=(await pool.query(`SELECT c.id,c.branch_id,b.name AS branch_name,c.business_date,c.entered_at,c.entry_type,c.expense_scope,c.category,c.description,c.amount
      FROM cash_book_entries c LEFT JOIN branches b ON b.id=c.branch_id
      WHERE ${where}
      ORDER BY c.business_date DESC,c.entered_at DESC,c.id DESC`,params)).rows;
    const summary=(await pool.query(`SELECT COUNT(*)::INT AS entries,COALESCE(SUM(c.amount),0)::NUMERIC(18,2) AS amount,
      COALESCE(SUM(c.amount) FILTER (WHERE c.expense_scope='BRANCH'),0)::NUMERIC(18,2) AS branch_amount,
      COALESCE(SUM(c.amount) FILTER (WHERE c.expense_scope='COMPANY'),0)::NUMERIC(18,2) AS company_amount
      FROM cash_book_entries c WHERE ${where}`,params)).rows[0]||{};
    res.json({
      branchId,month,scope:requestedScope,
      summary:{entries:Number(summary.entries||0),amount:Number(summary.amount||0),branchAmount:Number(summary.branch_amount||0),companyAmount:Number(summary.company_amount||0)},
      entries:rows.map(x=>({id:Number(x.id),branchId:x.branch_id===null?null:Number(x.branch_id),branchName:x.branch_name||null,businessDate:String(x.business_date).slice(0,10),enteredAt:x.entered_at,entryType:x.entry_type,expenseScope:x.expense_scope,category:x.category||"Other",description:x.description||null,amount:Number(x.amount)}))
    });
  } catch(e){next(e);}
}
