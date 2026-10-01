import react from 'react' 
import goodnightoldfriend from './goodnightoldfriend.png'

function App() {
  return (
    <main>
      <h1>Lift Off</h1>
      <p>great things are coming!</p>

      <p className="quote">
        "Vacation is supposed to be a break, don't make planning it a hassle."
      </p>
       <img src={goodnightoldfriend} alt="goodnightoldfriend" />
    </main>
  )
}

export default App