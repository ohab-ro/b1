// STABLE HOST PATCH (r4): additive stage reporting only. The host shell uses it
// to decide whether a failure may be retried with a page reload (pre-kernel) or
// needs a full console reboot (post-kernel), and to show real progress.
function __ohabStage(name, detail) {
  try {
    if (typeof window.__ohabTechHostStage === "function") window.__ohabTechHostStage(name, detail || "");
  } catch (e) {}
}

function load_script(src, remote = true, transfer = []) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    function removeScript() {
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      script.onload = null;
      script.onerror = null;
      removeScript();
      reject(new Error("Script load timed out: " + src));
    }, 15000);
    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    }
    script.src = src;
    script.onload = () => finish(resolve);
    script.onerror = () => {
      finish(reject, new Error("Script failed to load: " + src));
      removeScript();
    };
    document.head.appendChild(script);
  });
}

async function doJb() {
  try {
    await load_script("css/misc.js");
    version.init();
    switch (version.console) {
      case 4:
        await load_script("css/ps4/constants.js");
        await load_script("css/ps4/userland.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    logger.info("===USERLAND===");
    __ohabStage("webkit", "css fontface userland");

    let rw = undefined;
    if (arw.master === undefined) {
      rw = await init_rw();
    }

    init_arw(rw);
    init_rop();
    init_syscalls();

    logger.info("===END===");

    await load_script("css/loader.js");
    await load_script("css/workers.js");

    switch (version.console) {
      case 4:
        await load_script("css/ps4/kernel.js");
        break;
      case 5:
        //TODO
        break;
      default:
        logger.info("Unsupported console " + version.console);
    }

    if (fn.setuid.invoke(0) !== -1) {
      msgs.innerHTML = "GoldHEN is Already Loaded ...";
      __ohabStage("payload", "already-loaded");
      return;
    }

    var exploitChain = localStorage.getItem("exploitChain") || "lapse";
    if (exploitChain !== "lapse") {
      throw new Error("Unsupported exploit chain: " + exploitChain);
    }
    // STABLE HOST PATCH (r4): the kernel phase starts here - if this part fails
    // the host must not reload the page, only a reboot is safe.
    __ohabStage("kernel", "css " + exploitChain);
    await load_script("css/" + exploitChain + ".js");
    logger.info("===" + exploitChain.toUpperCase() + "===");

    try {
      if (exploitChain == "lapse") {
        init();
        await setup();
        await double_free_reqs2();
        leak_kaddrs();
        double_free_reqs1();
        make_karw();
        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");
        remove_pktinfo_from_so(pktopts_twins[0]);
        remove_rthdr_from_so(pktopts_twins[1]);
        remove_rthdr_from_so(rthdr_twins[0]);
        logger.info("Corrupted context cleanup completed !!");
      } else {
        init();
        await setup();
        await ucred_triple_free();
        leak_kqueue();
        await make_karw();
        inc_karw_pipe_refcnt();

        logger.info("Corrupted context cleanup started...");
        for (let i = 0; i < triplets.length; i++) {
          remove_rthdr_from_so(triplets[i]);
        }
        remove_uaf_file();
        logger.info("Corrupted context cleanup completed !!");
      }
    } finally {
      cleanup();
    }

    find_all_proc();

    if (fn.setuid.invoke(0) === -1) {
      jailbreak();

      const kpatches_rsp = await fetch("css/ps4/patches/" + constants.KPATCH);
      if (!kpatches_rsp || kpatches_rsp.status !== 200) {
        throw new Error("Kernel patch download failed");
      }
      const kpatches_buf = await kpatches_rsp.arrayBuffer();
      if (!kpatches_buf || kpatches_buf.byteLength < 32) {
        throw new Error("Kernel patch download was empty or truncated");
      }
      const kpatches_u8 = new Uint8Array(kpatches_buf);
      kernel_patches(kpatches_u8);

      const bin_rsp = await fetch("goldhen_2.4b18.12.bin");
      if (!bin_rsp || bin_rsp.status !== 200) {
        throw new Error("GoldHEN payload download failed");
      }
      const bin_buf = await bin_rsp.arrayBuffer();
      if (!bin_buf || bin_buf.byteLength < 1024) {
        throw new Error("GoldHEN payload download was empty or truncated");
      }
      const bin_u8 = new Uint8Array(bin_buf);
      // STABLE HOST PATCH (r4): refuse to jump into a blob that is not the
      // GoldHEN loader (flat blob starting with a rel32 jmp, 0xE9).
      if (bin_u8.length < 4 || bin_u8[0] !== 0xe9) {
        throw new Error("Payload is not a GoldHEN loader blob (first byte 0x" + (bin_u8[0] || 0).toString(16) + ")");
      }
      __ohabStage("payload", "mapping GoldHEN " + bin_u8.length + " bytes");
      load_bin(bin_u8);
      __ohabStage("payload", "GoldHEN thread created");
    }

    msgs.innerHTML = "GoldHEN v2.4b18.12 Loaded ...";
    logger.info("===END===");
    if (typeof window.__ohabTechHostSuccess === "function") {
      window.__ohabTechHostSuccess("CSS route GoldHEN loaded");
    }
  } catch (e) {
    msgs.innerHTML = "Failed to Load! Restart Your Console ...";
    msgs.style.color = "yellow";
    if (typeof window.__ohabTechHostFailure === "function") {
      window.__ohabTechHostFailure("The PS4 kernel loader stopped unexpectedly.");
    }
  }
}