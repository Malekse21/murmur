import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link className="wordmark" href="/" aria-label="MurMur home">
      <Image className="wordmark-mark" src="/murmur-logo.png" alt="" width={365} height={327} />
      <span>MurMur</span>
    </Link>
  );
}
