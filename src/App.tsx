import React from "react";
import "./custom.css";
import { Role, GPT35, useChatCompletion } from "./gpt-hooks";

function App() {
  const [textMessage, setTextMessage] = React.useState("");
  const [messages, setMessages] = useChatCompletion({
    model: GPT35.TURBO,
    apiKey: "API_KEY_HERE",
  });

  const onSend = () => {
    if (textMessage) {
      setMessages([{ content: textMessage, role: Role.USER }]);
      setTextMessage("");
    }
  };

  // It Moves to bottom when content is incresed
  React.useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [messages]);

  return (
    <div className='App'>
      <div className='chat-wrapper'>
        {messages.map((msg, i) => (
          <div className='message-wrapper' key={i}>
            {msg.role === Role.ASSISTANT ? (
              <pre className='chat-message'>{msg.content}</pre>
            ) : (
              <b>
                <pre className='chat-message'>{msg.content}</pre>
              </b>
            )}
          </div>
        ))}
      </div>
      <div className='prompt-wrapper'>
        <div>
          <textarea
            value={textMessage}
            placeholder='Write a question here'
            onChange={(event) => {
              setTextMessage(event.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            disabled={
              messages.length > 0 && messages[messages.length - 1].meta.loading
            }
          />
          <button onClick={onSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
