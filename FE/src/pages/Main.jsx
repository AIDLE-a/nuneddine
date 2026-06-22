function Main({ setPage }) {
  return (
    <div style={styles.container}>
      <h1>안녕하세요! 👋</h1>
      <p>나의 첫 리액트 페이지에 오신 것을 환영합니다.</p>
      <br />
      <div style={styles.buttonGroup}>
        <button style={styles.button} onClick={() => setPage('login')}>
          로그인하기
        </button>
        <button 
          style={{ ...styles.button, backgroundColor: '#007bff', color: 'white' }} 
          onClick={() => setPage('stock')}
        >
          주식 확인하기
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' },
  buttonGroup: { display: 'flex', gap: '10px', justifyContent: 'center' },
  button: { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '5px' }
}

export default Main