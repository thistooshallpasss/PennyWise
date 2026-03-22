from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import pdfplumber
import io
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import calendar

app = Flask(__name__)
CORS(app)

DEFAULT_PASSWORD = "HARS1406"
DB_URL = "postgresql://postgres.njscymlytvfbibircmbc:21976866%40Harsh@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

def get_db_connection():
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)

# Jinko expenses mein count NAHI karna hai
EXCLUDED_TAGS = "('Investments', 'Hostel Fees', 'Credit Card Bill')"

# === PDF PARSING ===
def parse_pdf_in_memory(pdf_bytes, password):
    transactions = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes), password=password) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables():
                    if not table: continue
                    for row in table:
                        try:
                            if len(row) >= 5 and row[0] and re.match(r'\d{2}-\d{2}-\d{4}', str(row[0]).strip()):
                                raw_date = str(row[0]).strip().split()[0]
                                d, m, y = raw_date.split('-')
                                formatted_date = f"{y}-{m}-{d}"
                                txn_id = str(row[1]).strip()
                                remarks = str(row[2]).strip().replace('\n', ' ')
                                amount_str = str(row[3]).strip()
                                txn_type = "Dr" if "(Dr)" in amount_str else "Cr" if "(Cr)" in amount_str else "Unknown"
                                amount = re.sub(r'[^\d.]', '', amount_str)
                                
                                if not amount or float(amount) == 0: continue
                                
                                transactions.append({
                                    "date": formatted_date,
                                    "transaction_id": txn_id,
                                    "remarks": remarks,
                                    "amount": float(amount),
                                    "type": txn_type,
                                    "tag_id": "" 
                                })
                        except: continue
        
        # Sort by latest date first
        transactions.sort(key=lambda x: datetime.strptime(x['date'], '%Y-%m-%d'), reverse=True)
        return {"status": "success", "data": transactions}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    pdf_bytes = request.files['file'].read()
    result = parse_pdf_in_memory(pdf_bytes, request.form.get('password', DEFAULT_PASSWORD))
    if result["status"] == "error": return jsonify({"error": result["message"]}), 500
    return jsonify({"message": "File parsed successfully!", "data": result["data"]}), 200

@app.route('/api/transactions/bulk', methods=['POST'])
def bulk_save_transactions():
    transactions = request.json.get('transactions', [])
    inserted = 0
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tags WHERE name = 'Undefined'")
        undefined_id = cursor.fetchone()['id']

        for txn in transactions:
            final_tag_id = txn.get('tag_id') if txn.get('tag_id') else undefined_id
            cursor.execute("""
                INSERT INTO transactions (date, transaction_id, remarks, amount, type, tag_id)
                VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (transaction_id) DO NOTHING;
            """, (txn['date'], txn['transaction_id'], txn['remarks'], txn['amount'], txn['type'], final_tag_id))
            if cursor.rowcount > 0: inserted += 1
            
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Saved successfully", "inserted": inserted}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/dashboard', methods=['GET'])
def get_dashboard_analytics():
    month = int(request.args.get('month', datetime.now().month))
    year = int(request.args.get('year', datetime.now().year))
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Crux
# Crux
        cursor.execute(f"SELECT COUNT(tr.id) as txns, SUM(tr.amount) as total FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(MONTH FROM tr.date) = %s AND EXTRACT(YEAR FROM tr.date) = %s;", (month, year))
        crux = cursor.fetchone()

        # Calendar
        cursor.execute(f"SELECT EXTRACT(DAY FROM tr.date) as day, SUM(tr.amount) as total FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(MONTH FROM tr.date) = %s AND EXTRACT(YEAR FROM tr.date) = %s GROUP BY day ORDER BY day;", (month, year))
        calendar_data = {int(row['day']): float(row['total']) for row in cursor.fetchall()}

        # Pie Charts: Monthly
        cursor.execute(f"SELECT t.name, SUM(tr.amount) as total_amount, COUNT(tr.id) as frequency FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(MONTH FROM tr.date) = %s AND EXTRACT(YEAR FROM tr.date) = %s GROUP BY t.name ORDER BY total_amount DESC;", (month, year))
        monthly_pie = cursor.fetchall()

        # Pie Charts: Yearly
        cursor.execute(f"SELECT t.name, SUM(tr.amount) as total_amount, COUNT(tr.id) as frequency FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(YEAR FROM tr.date) = %s GROUP BY t.name ORDER BY total_amount DESC;", (year,))
        yearly_pie = cursor.fetchall()

        # Pie Charts: Weekly (Last 7 days of the month with data)
        cursor.execute(f"""
            WITH MonthData AS (SELECT tr.date, tr.amount, t.name, tr.id FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(MONTH FROM tr.date) = %s AND EXTRACT(YEAR FROM tr.date) = %s),
            MaxDate AS (SELECT MAX(date) as mdate FROM MonthData)
            SELECT name, SUM(amount) as total_amount, COUNT(id) as frequency FROM MonthData, MaxDate WHERE date >= mdate - INTERVAL '7 days' GROUP BY name ORDER BY total_amount DESC;
        """, (month, year))
        weekly_pie = cursor.fetchall()

        # Grouped Preview List (Latest First)
        cursor.execute(f"SELECT TO_CHAR(tr.date, 'YYYY-MM-DD') as date, t.name as category, SUM(tr.amount) as amount, COUNT(tr.id) as frequency FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} GROUP BY tr.date, t.name ORDER BY tr.date DESC LIMIT 50;")
        preview_list = cursor.fetchall()

        # Top Transactions for News
        cursor.execute(f"SELECT remarks, amount, TO_CHAR(date, 'YYYY-MM-DD') as date FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.type = 'Dr' AND t.name NOT IN {EXCLUDED_TAGS} AND EXTRACT(MONTH FROM tr.date) = %s AND EXTRACT(YEAR FROM tr.date) = %s ORDER BY amount DESC LIMIT 15;", (month, year))
        top_txns = cursor.fetchall()

        cursor.close()
        conn.close()

        # 30 Insights
        insights = []
        if crux['total']:
            insights.append(f"💰 Total expenditure for {calendar.month_name[month]} is ₹{crux['total']:,.2f}.")
            insights.append(f"💳 You made {crux['txns']} debit transactions this month.")
            if crux['txns'] > 0: insights.append(f"📊 Your average transaction size is ₹{(crux['total']/crux['txns']):,.2f}.")
        
        for idx, cat in enumerate(monthly_pie):
            insights.append(f"🏷️ Category Alert: You spent ₹{cat['total_amount']:,.2f} on {cat['name']}.")
            if idx == 0: insights.append(f"🚨 Top Expense Area: '{cat['name']}' is draining most of your money.")
            
        for txn in top_txns[:8]:
            clean_rem = txn['remarks'][:25] + "..." if len(txn['remarks']) > 25 else txn['remarks']
            insights.append(f"💸 Major Hit: ₹{txn['amount']} spent on {txn['date']} ({clean_rem}).")

        tips = [
            "💡 Tip: Try saving 20% of your total income.", "📉 Insight: Track weekend spendings to avoid leaks.",
            "🍔 Did you know? Eating outside less can save ₹5,000 monthly.", "🏦 Security: Never share OTPs.",
            "📅 Habit: Review your calendar daily.", "⚡ Alert: Subscriptions often drain cash silently.",
            "🏥 Health is wealth: Keep an emergency fund for pharmacy bills.", "💳 Remember: Pay credit card bills strictly on time.",
            "🛒 Grocery tip: Always shop with a strict list.", "🚕 Commute: Compare Rapido/Uber rates daily."
        ]
        
        while len(insights) < 30: insights.extend(tips)

        return jsonify({
            "crux": {"total": crux['total'] or 0, "txns": crux['txns'] or 0},
            "calendar": calendar_data,
            "pie_charts": {"weekly": weekly_pie, "monthly": monthly_pie, "yearly": yearly_pie},
            "preview_list": preview_list,
            "news": insights[:30]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tags', methods=['GET'])
def get_all_tags():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM tags WHERE name != 'Undefined' ORDER BY name;")
    tags = cursor.fetchall()
    conn.close()
    return jsonify(tags), 200

@app.route('/api/export', methods=['GET'])
def export_transactions():
    start = request.args.get('start_date', '2026-03-01')
    end = request.args.get('end_date', '2026-03-31')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT TO_CHAR(tr.date, 'YYYY-MM-DD') as date, t.name as category, tr.amount FROM transactions tr JOIN tags t ON tr.tag_id = t.id WHERE tr.date >= %s AND tr.date <= %s ORDER BY tr.date DESC;", (start, end))
        txns = cursor.fetchall()
        cursor.close()
        conn.close()
        def generate():
            yield 'Date,Category,Amount\n'
            for txn in txns: yield f"{txn['date']},{txn['category']},{txn['amount']}\n"
        return Response(generate(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=pennywise_export.csv'})
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)