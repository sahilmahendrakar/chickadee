// A small note above the masthead, pointing to the Paradee post.
export default function Announce() {
  return (
    <a className="announce" href="/paradee">
      <span className="announce__tag">New</span>
      <span>Introducing Paradee, a light voice that runs on any computer.</span>
      <span className="announce__more">Read how it was made →</span>
    </a>
  );
}
