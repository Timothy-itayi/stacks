<script>
</script>

<div class="screen">
  <div class="content">
    <!-- Block asset background -->
    <div class="blocks-bg">
      <img src="/assets/block.png"               alt="" class="bg-block" style="top:3%;left:5%;width:52px;animation-delay:0s;transform:rotate(-12deg)" />
      <img src="/assets/block00.png"              alt="" class="bg-block" style="top:8%;right:10%;width:44px;animation-delay:-3s;transform:rotate(8deg)" />
      <img src="/assets/block01.png"              alt="" class="bg-block" style="top:18%;left:20%;width:48px;animation-delay:-7s;transform:rotate(-5deg)" />
      <img src="/assets/block02.png"              alt="" class="bg-block" style="top:12%;right:30%;width:40px;animation-delay:-1s;transform:rotate(15deg)" />
      <img src="/assets/block03.png"              alt="" class="bg-block" style="top:25%;left:8%;width:46px;animation-delay:-9s;transform:rotate(-20deg)" />
      <img src="/assets/block04.png"              alt="" class="bg-block" style="top:5%;left:55%;width:50px;animation-delay:-5s;transform:rotate(3deg)" />
      <img src="/assets/brick.png"                alt="" class="bg-block" style="top:30%;right:5%;width:56px;animation-delay:-11s;transform:rotate(-8deg)" />
      <img src="/assets/brick_high_2.png"         alt="" class="bg-block" style="top:40%;left:3%;width:42px;animation-delay:-2s;transform:rotate(22deg)" />
      <img src="/assets/brick_high_4.png"         alt="" class="bg-block" style="top:22%;right:8%;width:54px;animation-delay:-6s;transform:rotate(-14deg)" />
      <img src="/assets/brick_high_6.png"         alt="" class="bg-block" style="top:50%;right:15%;width:38px;animation-delay:-13s;transform:rotate(10deg)" />
      <img src="/assets/detail_stone.png"         alt="" class="bg-block" style="top:60%;left:12%;width:50px;animation-delay:-4s;transform:rotate(-6deg)" />
      <img src="/assets/explosive.png"            alt="" class="bg-block" style="top:45%;left:25%;width:44px;animation-delay:-8s;transform:rotate(18deg)" />
      <img src="/assets/extra_box_exclamation.png" alt="" class="bg-block" style="top:55%;right:8%;width:48px;animation-delay:-10s;transform:rotate(-25deg)" />
      <img src="/assets/extra_crate.png"          alt="" class="bg-block" style="top:70%;left:5%;width:52px;animation-delay:-14s;transform:rotate(7deg)" />
      <img src="/assets/extra_dirt.png"           alt="" class="bg-block" style="top:65%;right:22%;width:46px;animation-delay:-1.5s;transform:rotate(-11deg)" />
      <img src="/assets/extra_dirt_detail.png"    alt="" class="bg-block" style="top:75%;left:30%;width:40px;animation-delay:-7.5s;transform:rotate(14deg)" />
      <img src="/assets/extra_dirt_top.png"       alt="" class="bg-block" style="top:80%;right:5%;width:54px;animation-delay:-3.5s;transform:rotate(-9deg)" />
      <img src="/assets/extra_stone_top.png"      alt="" class="bg-block" style="top:85%;left:8%;width:44px;animation-delay:-12s;transform:rotate(20deg)" />
      <img src="/assets/stone.png"                alt="" class="bg-block" style="top:35%;left:45%;width:38px;animation-delay:-5.5s;transform:rotate(-17deg)" />
      <img src="/assets/hammer.png"               alt="" class="bg-block" style="top:90%;right:35%;width:42px;animation-delay:-9.5s;transform:rotate(6deg)" />
      <img src="/assets/block.png"                alt="" class="bg-block" style="top:15%;left:75%;width:36px;animation-delay:-2.5s;transform:rotate(-22deg)" />
      <img src="/assets/brick.png"                alt="" class="bg-block" style="top:72%;right:40%;width:50px;animation-delay:-6.5s;transform:rotate(12deg)" />
      <img src="/assets/extra_crate.png"          alt="" class="bg-block" style="top:48%;right:35%;width:42px;animation-delay:-11.5s;transform:rotate(-4deg)" />
      <img src="/assets/block03.png"              alt="" class="bg-block" style="top:88%;left:50%;width:46px;animation-delay:-8.5s;transform:rotate(16deg)" />
    </div>

    <!-- Title -->
    <h1 class="title">STACKS</h1>
    <p class="tagline">Clear the chaos. Survive the pile.</p>

    <!-- Instructions -->
    <div class="instructions">
      <div class="instruction-row">
        <img src="/assets/extra_dirt_detail.png" alt="" class="instruction-icon" />
        <span>Click <strong>dirt</strong> blocks to destroy them</span>
      </div>
      <div class="instruction-row">
        <img src="/assets/explosive.png" alt="" class="instruction-icon" />
        <span><strong class="text-explosive">Explosive</strong> blocks blast ~5 nearby blocks</span>
      </div>
      <div class="instruction-row">
        <img src="/assets/detail_stone.png" alt="" class="instruction-icon" />
        <span><strong class="text-stone">Stone</strong> blocks can only be blown up</span>
      </div>
      <div class="instruction-row">
        <img src="/assets/block02.png" alt="" class="instruction-icon" />
        <span><strong class="text-protected">Protected</strong> blocks must not be blown up &mdash; instant game over</span>
      </div>
      <p class="instruction-note">Blocks fall faster over time. Keep the box from filling up.</p>
    </div>

    <!-- Start button -->
    <a href="/game" class="start-btn">
      Start Game
    </a>

    <!-- Credit -->
    <p class="credit">
      Made by <a href="https://www.timothyitayi.com" target="_blank" rel="noopener noreferrer">Timothy</a>
    </p>
  </div>
</div>

<style>
  .screen {
    min-height: 100vh;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
    overflow: hidden;
    position: relative;
  }

  .content {
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 480px;
    padding: 2rem;
  }

  .title {
    font-size: 5rem;
    font-weight: 900;
    letter-spacing: 0.15em;
    color: #fbbf24;
    margin: 0 0 0.25rem 0;
    text-shadow: 0 0 40px rgba(251, 191, 36, 0.3);
  }

  .tagline {
    color: #d97706;
    font-size: 1rem;
    margin: 0 0 2.5rem 0;
    opacity: 0.8;
  }

  .instructions {
    text-align: left;
    margin: 0 auto 2.5rem auto;
    max-width: 340px;
  }

  .instruction-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    color: #fef3c7;
    font-size: 0.8rem;
    border-bottom: 1px solid rgba(120, 53, 15, 0.2);
  }

  .instruction-row strong {
    color: #fbbf24;
  }

  .instruction-row :global(.text-explosive) {
    color: #ef4444;
  }

  .instruction-row :global(.text-stone) {
    color: #9ca3af;
  }

  .instruction-row :global(.text-protected) {
    color: #4ade80;
  }

  .instruction-icon {
    width: 28px;
    height: 28px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .instruction-note {
    color: #92400e;
    font-size: 0.7rem;
    margin: 0.75rem 0 0 0;
    text-align: center;
  }

  .start-btn {
    display: inline-block;
    background: transparent;
    border: 2px solid #fbbf24;
    color: #fbbf24;
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 0.85rem 3rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    text-decoration: none;
  }

  .start-btn:hover {
    background: #fbbf24;
    color: #111;
  }

  .credit {
    margin-top: 2rem;
    font-size: 0.65rem;
    color: #78350f;
    opacity: 0.6;
  }

  .credit a {
    color: #d97706;
    text-decoration: none;
    transition: color 0.2s;
  }

  .credit a:hover {
    color: #fbbf24;
  }

  .blocks-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .bg-block {
    position: absolute;
    image-rendering: pixelated;
    opacity: 0.06;
    animation: float 18s ease-in-out infinite;
  }

  .bg-block:nth-child(odd) {
    animation-duration: 22s;
  }

  .bg-block:nth-child(3n) {
    opacity: 0.1;
  }

  .bg-block:nth-child(5n) {
    animation-duration: 26s;
  }

  @keyframes float {
    0%, 100% { translate: 0 0; }
    33% { translate: 0 -12px; }
    66% { translate: 0 8px; }
  }
</style>
