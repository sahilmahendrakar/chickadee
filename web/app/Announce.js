// A small note above the masthead, pointing to the latest Paradee post.
export default function Announce() {
  return (
    <a className="announce" href="/paradee-1-3">
      <span className="announce__tag">New</span>
      <span>Paradee 1.3 now speaks English, Hindi, French, and Spanish.</span>
      <span className="announce__more">Read about it →</span>
    </a>
  );
}
