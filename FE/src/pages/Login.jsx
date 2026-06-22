function Login({ setPage }) {
  return (
    <div style={styles.container}>
      <h2>🔐 로그인 페이지</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '200px', margin: '0 auto' }}>
        <input type="text" placeholder="아이디" style={styles.input} />
        <input type="password" placeholder="비밀번호" style={styles.input} />
        <button 
          style={{ ...styles.button, backgroundColor: '#28a745', color: 'white' }} 
          onClick={() => alert('로그인 성공!')}
        >
          로그인 완료
        </button>
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
  button: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '5px' },
  input: { padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' },
  linkButton: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }
}

export default Login