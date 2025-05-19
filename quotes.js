// Motivational quotes about productivity and not wasting time
const PRODUCTIVITY_QUOTES = [
  { text: "The key is not to prioritize what’s on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "You can do anything, but not everything.", author: "David Allen" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "What is important is seldom urgent, and what is urgent is seldom important.", author: "Dwight D. Eisenhower" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It’s not about having time. It’s about making time.", author: "Unknown" },
  { text: "Don’t watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Routine, in an intelligent man, is a sign of ambition.", author: "W.H. Auden" },
  { text: "It’s not that I’m so smart, it’s just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Success doesn’t come from what you do occasionally, it comes from what you do consistently.", author: "Marie Forleo" },
  { text: "You may delay, but time will not.", author: "Benjamin Franklin" },
  { text: "The best way to get something done is to begin.", author: "Unknown" },
  { text: "The only difference between success and failure is the ability to take action.", author: "Alexander Graham Bell" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The tragedy in life doesn’t lie in not reaching your goal. The tragedy lies in having no goal to reach.", author: "Benjamin Mays" },
  { text: "Your mindset determines your success.", author: "Tony Robbins" },
  { text: "Don’t wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "You don’t have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The biggest room in the world is the room for improvement.", author: "Helmut Schmidt" },
  { text: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
  { text: "Work hard in silence; let success make the noise.", author: "Frank Ocean" },
  { text: "Don’t count the days, make the days count.", author: "Muhammad Ali" },
  { text: "If people knew how hard I had to work to gain my mastery, it wouldn’t seem so wonderful at all.", author: "Michelangelo" },
  { text: "Great things are not done by impulse, but by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Dream big. Start small. Act now.", author: "Robin Sharma" },
  { text: "Ideas are easy. Implementation is hard.", author: "Guy Kawasaki" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Execution is the chariot of genius.", author: "William Blake" },
  { text: "If you spend too much time thinking about a thing, you’ll never get it done.", author: "Bruce Lee" },
  { text: "I have not failed. I’ve just found 10,000 ways that won’t work.", author: "Thomas Edison" },
  { text: "Failure is not the opposite of success; it’s part of success.", author: "Arianna Huffington" },
  { text: "Fall seven times and stand up eight.", author: "Japanese Proverb" },
  { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Mistakes are proof that you are trying.", author: "Jennifer Lim" }
];

// Function to get a random quote
function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * PRODUCTIVITY_QUOTES.length);
  return PRODUCTIVITY_QUOTES[randomIndex];
} 