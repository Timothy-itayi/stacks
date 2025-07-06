<script>
  let score = 0;
  let currentHeight = 4.5; // in meters
  let targetHeight = 10; // goal in meters
</script>

<div class="fixed top-6 left-6 bg-black/80 text-white rounded-2xl p-4 shadow-lg w-56 max-w-full
            flex flex-col space-y-4
            border border-white/20
            select-none
            font-sans
            text-sm
            ">
  <h1 class="text-lg font-semibold flex items-center gap-2">
    🪵 Crate Stacker
  </h1>

  <div class="flex items-center justify-between">
    <span class="font-medium">Score:</span>
    <span class="text-lg font-bold">{score}</span>
  </div>

  <div class="space-y-1">
    <div class="flex justify-between text-xs font-medium">
      <span>Height</span>
      <span>{currentHeight.toFixed(1)} m / {targetHeight} m</span>
    </div>
    <div class="w-full h-3 bg-white/20 rounded-full overflow-hidden">
      <div
        class="h-full bg-green-400 transition-all duration-300"
        style="width: {(currentHeight / targetHeight) * 100}%"
      ></div>
    </div>
  </div>
</div>
