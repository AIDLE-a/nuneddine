function Stock({ setPage }) {
  return (
    <div style={styles.container}>
      <h2>📈 실시간 주식 정보</h2>
      <div style={styles.stockBox}>
        <p><strong>삼성전자:</strong> 72,300원 (<span style={{ color: 'red' }}>▲ 1.5%</span>)</p>
        <p><strong>애플:</strong> 182.5 달러 (<span style={{ color: 'blue' }}>▼ 0.8%</span>)</p>
        <p><strong>테슬라:</strong> 245.1 달러 (<span style={{ color: 'red' }}>▲ 3.2%</span>)</p>
      </div>
      <br />
      <button style={styles.linkButton} onClick={() => setPage('main')}>
        ← 메인으로 돌아가기
      </button>
    </div>
  )
}

const styles = {
  container: { textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' },
  stockBox: { border: '1px solid #ddd', padding: '20px', display: 'inline-block', borderRadius: '8px', textAlign: 'left', backgroundColor: '#f9f9f9' },
  linkButton: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }
}

export default Stock