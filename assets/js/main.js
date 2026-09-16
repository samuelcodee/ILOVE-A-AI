(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- menu mobile ---------- */
  const nav    = document.querySelector('.nav');
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');

  const setMenu = (open) => {
    links.classList.toggle('is-open', open);
    nav.classList.toggle('nav--open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  toggle.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));

  /* ---------- quanto o cabeçalho e o dock realmente ocupam ----------
     Os dois tinham a altura chutada num clamp(). No celular o cabeçalho
     quebra em duas linhas e fica 28px mais alto que o chute, e era por isso
     que ele encostava no painel do hero — e o painel, por sua vez, terminava
     exatamente na borda do dock. Aqui a altura é medida e ainda ganha uma
     folga, pra nenhuma das duas peças flutuantes chegar perto do conteúdo. */
  const raizEl = document.documentElement;
  const medeCromo = () => {
    const cab = document.querySelector('.nav');
    const barra = document.querySelector('.dock__bar');
    /* com o menu aberto o cabeçalho cresce; essa altura não é a que vale */
    if (cab && !cab.querySelector('.nav__links.is-open')) {
      raizEl.style.setProperty('--nav-h',
        Math.ceil(cab.getBoundingClientRect().height) + 14 + 'px');
    }
    if (barra) {
      const desdeABase = parseFloat(getComputedStyle(barra.parentElement).bottom) || 0;
      raizEl.style.setProperty('--dock-h',
        Math.ceil(barra.getBoundingClientRect().height + desdeABase) + 16 + 'px');
    }
  };
  medeCromo();
  addEventListener('resize', medeCromo);
  /* a fonte da marca chega depois e muda a altura do cabeçalho */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medeCromo);

  /* ---------- letras dos títulos ----------
     Cada letra entra girada e deslocada e assenta no lugar. O atraso cresce
     da última letra para a primeira, então a frase se monta de trás pra frente. */
  const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  document.querySelectorAll('.giant, .titulo').forEach((titulo) => {
    const lines = [...titulo.querySelectorAll('.ln')];
    const total = lines.reduce((sum, ln) => sum + ln.textContent.length, 0);
    let i = 0;

    lines.forEach((ln) => {
      const chars = [...ln.textContent];
      ln.textContent = '';
      chars.forEach((ch) => {
        const el = document.createElement('i');
        el.textContent = ch === ' ' ? ' ' : ch;
        el.style.setProperty('--dx',  (hash(i) * 0.7 - 0.3).toFixed(2) + 'em');
        el.style.setProperty('--dy',  (-0.6 - hash(i + 99) * 0.6).toFixed(2) + 'em');
        el.style.setProperty('--rot', (-10 - hash(i + 7) * 28).toFixed(1) + 'deg');
        el.style.setProperty('--d',   (total - 1 - i) * 28 + 'ms');
        ln.appendChild(el);
        i++;
      });
    });
  });

  /* ---------- o vídeo do hero acompanha o scroll ----------
     Parado, ele roda sozinho em loop. Assim que a roda do mouse se move, o
     tempo do vídeo passa a seguir a posição do scroll: para baixo a câmera
     entra na tigela, para cima ela sai. Alguns instantes sem scroll e ele
     volta a rodar sozinho, de onde parou.

     O arquivo é um vai-e-volta, então o instante t e o instante (dur - t)
     mostram exatamente o mesmo quadro. Dobrando o tempo sempre para a metade
     de ida, a troca entre "rodando sozinho" e "preso ao scroll" nunca dá
     salto de imagem, mesmo quando o loop já passou da metade.

     Vale no dedo também. Isso já esteve desligado no toque porque a busca
     engasgava — mas o culpado era o ARQUIVO, não o dedo: o vídeo do celular
     tinha um keyframe a cada 250 quadros, e cada busca obrigava o
     decodificador a remontar até 250 quadros pra chegar no instante pedido.
     Medido: 88ms por busca, contra 16,7ms de orçamento por quadro. Com GOP
     16 a mesma busca custa 10ms e cabe folgado dentro do quadro. */
  /* distância mínima entre o tempo pedido e o tempo atual pra valer uma
     busca nova; ajustado à taxa de quadros do arquivo que for escolhido */
  let QUADRO = 1 / 30;
  /* e o passo que realmente vale, que cresce se o aparelho não der conta */
  let PASSO = 1 / 30;

  /* O iOS só libera autoplay pra vídeo comprovadamente mudo e em linha, e
     consulta as propriedades, não os atributos do HTML. Com o src definido
     por script — que é o nosso caso nos dois vídeos — o atributo sozinho não
     conta, e a recusa vem sem erro nenhum no console. Toda chamada de play
     passa por aqui pra nunca mais depender disso. */
  const tocar = (v) => {
    if (!v) return Promise.reject();
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    const p = v.play();
    return (p && p.catch) ? p : Promise.resolve();
  };

  /* ---------- animar por busca ----------
     Mover currentTime não precisa de permissão nenhuma, então dá pra animar
     um vídeo que o aparelho não deixa tocar. Custa mais CPU que deixar tocar,
     por isso só entra quando tocar não funciona de verdade. */
  const criaDeriva = (v, emCena, passoDe) => {
    let raf = 0, ultimo = 0, acum = 0;
    const parar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; ultimo = 0; acum = 0; };
    const quadro = () => {
      raf = 0;
      if (!v.paused || document.hidden || !v.duration || !emCena()) { ultimo = 0; acum = 0; return; }
      const agora = performance.now();
      const dt = ultimo ? Math.min(100, agora - ultimo) : 0;
      ultimo = agora;
      acum += dt / 1000;
      if (acum >= passoDe() && !v.seeking) {
        let t = v.currentTime + acum;
        acum = 0;
        if (t >= v.duration) t = 0;
        v.currentTime = t;
      }
      raf = requestAnimationFrame(quadro);
    };
    return {
      comecar: () => { if (!raf && !reduced) raf = requestAnimationFrame(quadro); },
      parar,
    };
  };

  /* O iOS mente de DUAS formas: pode recusar o play() e pode RESOLVER o
     play() sem mover um único quadro (Modo de Baixo Consumo faz isso). Então
     a promessa não prova nada — quem prova é o relógio do próprio vídeo.
     Se ele não andou, pausa de verdade (pra normalizar o estado) e chama o
     plano B. */
  const naoAndou = new WeakSet();
  const provaMovimento = (v, planoB, tentativa) => {
    const t0 = v.currentTime;
    setTimeout(() => {
      if (v.seeking || v.currentTime !== t0) return;      /* andou: tudo certo */
      if (v.readyState < 2 && (tentativa || 0) < 4) {     /* ainda carregando */
        return provaMovimento(v, planoB, (tentativa || 0) + 1);
      }
      try { v.pause(); } catch (e) {}
      naoAndou.add(v);
      planoB();
    }, 520);
  };

  const hero  = document.getElementById('hero');
  const video = document.querySelector('.media__slot--live video');
  const podeArrastar = !!video && !reduced;

  /* Duas versões do mesmo vídeo: a pesada (crf 22, 6 MB) só vai pra quem tem
     mouse e tela grande — que é exatamente quem arrasta a animação pelo scroll
     e enxerga a diferença. No celular continua a de 3,2 MB. Economia de dados
     ou rede fraca derrubam a pesada mesmo no desktop. */
  if (video && !video.getAttribute('src')) {
    const rede = navigator.connection || {};
    const aguenta = !rede.saveData && !/2g/.test(rede.effectiveType || '');
    /* Três degraus. O de celular é 720x372 a 20 q/s com GOP 16: 1,1 MB
       contra os 731 kB do anterior, e em troca cada busca cai de 88ms para
       10ms. Pelo SSIM ele ainda é melhor de imagem que o antigo (0,971
       contra 0,942), porque o que inchava o arquivo velho não era qualidade,
       era o intervalo enorme entre keyframes.

       O arquivo pesado (crf 22) continua só pra tela grande com rede boa. */
    const fino = matchMedia('(pointer:fine)').matches;
    const fonte = !fino ? video.dataset.sm
                : (aguenta && innerWidth >= 900 && video.dataset.hd) ? video.dataset.hd
                : video.dataset.sd;

    /* o de celular é 20 q/s, os outros 30: é esta a distância mínima que
       vale uma busca nova */
    QUADRO = PASSO = !fino ? 1 / 20 : 1 / 30;

    /* Em qualquer tela o vídeo agora é a interação — o scroll arrasta o
       tempo dele — então ele não pode chegar atrasado em nenhuma. */
    video.src = fonte || video.dataset.sd;
  }

  let dur = 0, meia = 0, alvo = 0, atual = 0, presoAoScroll = false, raf = 0;

  /* silêncio de roda que devolve o vídeo pro loop. 70ms passa folgado
     entre dois cliques de wheel (que chegam a cada ~40ms enquanto se
     gira) e é curto demais pra virar imagem parada aos olhos. */
  const FOLGA = 70;
  let ultimoScroll = 0;

  const dobra = (t) => (t <= meia ? t : dur - t);

  const noHero = () => {
    const r = hero.getBoundingClientRect();
    return r.bottom > innerHeight * 0.15;
  };

  /* quanto do hero já passou — ele é alto e fica preso, então esse trecho de
     scroll é a linha do tempo do vídeo */
  const progresso = () => {
    const span = hero.offsetHeight - innerHeight;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / span));
  };

  /* Persegue o alvo em vez de pular até ele: a roda do mouse anda aos
     solavancos, e buscar direto em cada salto faz a imagem pipocar.

     A perseguição é por TEMPO, não por quadro. Com um fator fixo por quadro a
     imagem alcança o scroll no dobro da velocidade num monitor de 120 Hz e na
     metade num de 30 — o mesmo código com sensação diferente dependendo da
     tela. Com o expoente no tempo decorrido, a resposta é a mesma em todas.

     0.22 por quadro de 60 Hz: alcança 90% do caminho em ~9 quadros (150ms).
     Era 0.16, que levava ~13 quadros e deixava a imagem visivelmente atrás
     do dedo. */
  const PERSEGUE = 0.22;
  let ultimoQuadro = 0;

  const passo = () => {
    const agora = performance.now();
    /* o primeiro quadro depois de uma pausa não pode valer por vinte */
    const dt = ultimoQuadro ? Math.min(64, agora - ultimoQuadro) / 16.67 : 1;
    ultimoQuadro = agora;

    atual += (alvo - atual) * (1 - Math.pow(1 - PERSEGUE, dt));
    if (Math.abs(alvo - atual) < QUADRO * 1.5) atual = alvo;
    if (!video.seeking && Math.abs(video.currentTime - atual) >= PASSO) video.currentTime = atual;

    /* Alcançou o scroll E a roda está quieta: devolve pro loop agora.
       Alcançou mas a roda ainda anda: continua de olho, sem soltar.
       Antes isso era um setTimeout fixo, e o vídeo passava o intervalo
       inteiro congelado no mesmo quadro. */
    if (atual === alvo && performance.now() - ultimoScroll >= FOLGA) { solta(); return; }
    raf = requestAnimationFrame(passo);
  };

  const derivaHero = video
    ? criaDeriva(video, () => noHero() && !presoAoScroll, () => PASSO)
    : { comecar() {}, parar() {} };
  const comecaADeriva = () => derivaHero.comecar();
  const paraADeriva = () => derivaHero.parar();

  function largaOScroll() {
    presoAoScroll = false;
    ultimoQuadro = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function solta() {
    largaOScroll();
    if (video && noHero()) {
      tocar(video).catch(comecaADeriva);
      provaMovimento(video, comecaADeriva);
    }
  }

  /* aba escondida não desenha, mas vídeo em laço continua decodificando e
     gastando bateria — no celular isso importa mais que em qualquer outro
     lugar. Volta a rodar quando a aba volta, se o hero ainda estiver em cena. */
  document.addEventListener('visibilitychange', () => {
    if (!video) return;
    if (document.hidden) video.pause();
    else if (noHero() && !presoAoScroll) tocar(video).catch(comecaADeriva);
  });

  function arrasta() {
    if (!video) return;

    /* fora de cena o vídeo não precisa rodar */
    if (!noHero()) {
      largaOScroll();
      if (!video.paused) video.pause();
      return;
    }
    if (!podeArrastar || !dur) {
      if (video.paused) tocar(video).catch(() => {});
      return;
    }

    if (!presoAoScroll) {
      paraADeriva();
      presoAoScroll = true;
      video.pause();
      atual = dobra(video.currentTime);
    }
    ultimoScroll = performance.now();
    alvo = progresso() * meia;
    if (!raf) raf = requestAnimationFrame(passo);
  }

  /* Quanto custa, NESTE aparelho, pedir um instante novo. Média móvel: um
     pico isolado não pode mudar o comportamento, mas um aparelho
     consistentemente lento sim. Acima de 24ms a busca já não cabe num quadro
     de 60 Hz, então vale pedir menos e mais espaçado — a imagem anda em
     degraus um pouco maiores, que é muito menos visível que engasgo. */
  if (podeArrastar) {
    let custo = 0, pedidaEm = 0;
    video.addEventListener('seeking', () => { pedidaEm = performance.now(); });
    video.addEventListener('seeked', () => {
      if (!pedidaEm) return;
      const d = performance.now() - pedidaEm;
      pedidaEm = 0;
      custo = custo ? custo * 0.8 + d * 0.2 : d;
      PASSO = custo > 24 ? QUADRO * 3 : custo > 14 ? QUADRO * 2 : QUADRO;
    });
  }

  if (podeArrastar) {
    const medido = () => { dur = video.duration; meia = dur / 2; };
    video.readyState >= 1
      ? medido()
      : video.addEventListener('loadedmetadata', medido, { once: true });
  }

  /* autoplay pode ser recusado (aba em segundo plano, política do navegador);
     pedir o play explicitamente deixa o comportamento previsível. Quem pediu
     menos movimento no sistema fica com a tigela parada no primeiro quadro. */
  if (video) {
    if (reduced) { video.autoplay = false; video.loop = false; video.pause(); }
    else { tocar(video).catch(comecaADeriva); provaMovimento(video, comecaADeriva); }
  }

  /* O iOS recusa o autoplay em algumas situações e aí desenha um botão de
     play por cima do poster — cara de vídeo pra assistir, que é justamente o
     contrário do que isto é. Buscar (currentTime) não precisa de permissão
     nenhuma, então mesmo recusado o arrasto funciona; este toque só devolve
     o laço quando o dedo permite. Uma vez só, e passivo. */
  if (video && !reduced) {
    const destrava = () => {
      tocar(video).then(() => { if (presoAoScroll) video.pause(); }).catch(() => {});
    };
    addEventListener('touchstart', destrava, { once: true, passive: true });
    addEventListener('pointerdown', destrava, { once: true, passive: true });
    /* e o mesmo toque devolve qualquer reel que tenha ficado pra trás */
    /* Gesto do usuário derruba a política de autoplay do iOS, então vale
       apagar o "não anda" e tentar de novo — inclusive pro hero. */
    const destravaReels = () => {
      naoAndou.delete(video);
      document.querySelectorAll('.reel video').forEach((v) => {
        naoAndou.delete(v);
        if (!v.dataset.src && v.getAttribute('src') && v.paused) tocar(v).catch(() => {});
      });
    };
    addEventListener('touchstart', destravaReels, { once: true, passive: true });
  }

  /* ---------- a seção da loja ----------
     Revela quando entra em cena e não desfaz: reanimar a cada passagem cansa
     quem sobe e desce a página. O reel desliza um pouco mais devagar que o
     resto enquanto a seção passa, o que dá profundidade sem exagero. */
  const revelaveis = [...document.querySelectorAll('[data-revela]')];
  const revela = () => {
    for (let i = revelaveis.length - 1; i >= 0; i--) {
      const el = revelaveis[i];
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.84 && r.bottom > 0) {
        el.classList.add('is-in');
        revelaveis.splice(i, 1);
        // só agora vale baixar o vídeo da seção: quem não desce não paga por ele
        el.querySelectorAll('video[data-src]').forEach((v) => {
          /* com preload="none" o play() logo depois do src é pedir play num
             elemento que ainda não tem um único quadro; pedir de novo quando
             o primeiro quadro chega é o que torna o começo confiável */
          v.preload = 'auto';
          v.src = v.dataset.src;
          v.removeAttribute('data-src');
          if (reduced) return;
          const tenta = () => {
            tocar(v).catch(() => {});
            provaMovimento(v, () => {
              const d = derivaDoReel.get(v);
              if (d) d.comecar(); else cuidaDosReels();
            });
          };
          tenta();
          v.addEventListener('loadeddata', tenta, { once: true });
        });
        el.querySelectorAll('iframe[data-src]').forEach((f) => {
          f.src = f.dataset.src;
          f.removeAttribute('data-src');
        });
      }
    }
  };

  /* Um vídeo de seção que está na tela e parado tenta de novo — é o que
     conserta o reel congelado quando o primeiro play() foi recusado. O que
     saiu da tela pausa: vídeo em laço fora de vista é bateria queimada à
     toa, e no celular isso pesa mais que em qualquer outro lugar. */
  const reels = [...document.querySelectorAll('.reel video')];
  const naTelaO = (v) => { const r = v.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const derivaDoReel = new WeakMap();
  const derivaPara = (v) => {
    let d = derivaDoReel.get(v);
    if (!d) { d = criaDeriva(v, () => naTelaO(v), () => 1 / 20); derivaDoReel.set(v, d); }
    return d;
  };
  const cuidaDosReels = () => {
    if (reduced) return;
    for (const v of reels) {
      if (v.dataset.src || !v.getAttribute('src')) continue;
      const naTela = naTelaO(v);
      if (!naTela) { derivaPara(v).parar(); if (!v.paused) v.pause(); continue; }
      /* Já sabemos que este não anda sozinho: não adianta pedir play de novo
         a cada quadro de scroll — anima na mão e pronto. */
      if (naoAndou.has(v)) { derivaPara(v).comecar(); continue; }
      if (v.paused) {
        tocar(v).catch(() => {});
        provaMovimento(v, () => derivaPara(v).comecar());
      }
    }
  };

  const secaoLoja = document.getElementById('loja');
  const reel = document.querySelector('.reel');
  const desliza = () => {
    if (!reel || reduced) return;
    const r = secaoLoja.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    // -1 quando a seção entra por baixo, +1 quando sai por cima
    const p = 1 - (r.top + r.height / 2) / (innerHeight / 2 + r.height / 2);
    reel.style.setProperty('--desliza', (p * 26).toFixed(1) + 'px');
  };

  /* o roxo do fundo escurece quando a loja toma a tela — a emenda entre as
     seções fica mais macia do que um corte seco de cor. A zona também acende
     o botão certo do dock. */
  const dockBtns = [...document.querySelectorAll('.dock__btn[data-ir]')];
  const secaoCardapio = document.getElementById('cardapio');
  const zonas = [
    { el: hero,          nome: 'hero',     href: '#hero' },
    { el: secaoLoja,     nome: 'loja',     href: '#loja' },
    { el: secaoCardapio, nome: 'cardapio', href: '#cardapio' },
    { el: document.getElementById('delivery'), nome: 'delivery', href: '#delivery' },
    { el: document.getElementById('mapa'),     nome: 'mapa',     href: '#mapa' },
  ].filter(z => z.el);

  let zona = 'hero';
  const marcaZona = () => {
    const limite = innerHeight * 0.45;
    let nova = zonas[0];
    for (const z of zonas) if (z.el.getBoundingClientRect().top < limite) nova = z;
    if (nova.nome === zona) return;
    zona = nova.nome;
    document.body.dataset.zona = zona;
    dockBtns.forEach(b => b.classList.toggle('is-active', b.getAttribute('href') === nova.href));
  };


  /* ---------- selo vivo do delivery ----------
     A loja fecha às 23h, mas a moto para antes: 22h40 de segunda a sexta,
     21h40 no fim de semana. Sem isto a pessoa que chega às 15h manda
     mensagem, não recebe resposta e desiste — a seção informa o horário
     mas não responde a única pergunta que ela tem, que é "agora?". */
  const selo = document.getElementById('entregaSelo');
  if (selo) {
    const seloTxt = document.getElementById('entregaSeloTxt');
    const linhasHora = [...document.querySelectorAll('.hora')];
    const ABERTURA = 18 * 60 + 30;
    const fimDo = (dia) => (dia === 0 || dia === 6 ? 21 * 60 + 40 : 22 * 60 + 40);
    const ehFds = (dia) => dia === 0 || dia === 6;
    const hhmm = (m) => Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');

    /* O relógio que vale é o de Fortaleza, não o do aparelho: quem abrisse o
       site de outro fuso veria "fechado" no meio do expediente. Se o
       navegador não souber lidar com fuso nomeado, cai no relógio local —
       errado só para quem está fora, que é o caso raro. */
    const agoraNaLoja = () => {
      try {
        const partes = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Fortaleza',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date());
        const v = {};
        partes.forEach((x) => { v[x.type] = x.value; });
        return {
          dia: new Date(Date.UTC(+v.year, +v.month - 1, +v.day)).getUTCDay(),
          min: (+v.hour % 24) * 60 + (+v.minute),
        };
      } catch (e) {
        const d = new Date();
        return { dia: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
      }
    };

    let ultimo = '';
    const atualizaSelo = () => {
      const { dia, min } = agoraNaLoja();
      const fecha = fimDo(dia);
      const aberto = min >= ABERTURA && min < fecha;

      let estado, texto;
      if (aberto) {
        estado = 'aberto';
        texto = 'entregando agora — até ' + hhmm(fecha);
      } else if (min < ABERTURA) {
        estado = 'fechado';
        texto = 'fechado — abre hoje às ' + hhmm(ABERTURA);
      } else {
        estado = 'fechado';
        texto = 'fechado — volta amanhã às ' + hhmm(ABERTURA);
      }

      /* só escreve quando muda de verdade: com aria-live, reescrever o mesmo
         texto a cada meio minuto faz o leitor de tela repetir a frase */
      if (texto !== ultimo) {
        ultimo = texto;
        seloTxt.textContent = texto;
        selo.dataset.estado = estado;
      }
      const hoje = ehFds(dia) ? 'fds' : 'semana';
      linhasHora.forEach((l) => l.classList.toggle('is-hoje', l.dataset.dia === hoje));
    };

    atualizaSelo();
    setInterval(atualizaSelo, 30000);
    /* celular no bolso por três horas volta com o selo mentindo */
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') atualizaSelo();
    });
  }

  /* ---------- palco das categorias ----------
     Carrossel de vitrine com quatro papéis: centro, esquerda, direita e fundo.
     Todo o resto fica "fora" — encolhido e invisível no meio, pra entrar e
     sair sempre pelo mesmo lugar. Não existe seta: quem gira é o clique na
     própria categoria, o arraste do dedo ou as setas do teclado. O clique no
     centro, esse sim, desce pro cardápio daquela categoria. */
  let palcoAbre = () => {}, palcoCena = () => 'vitrine';
  const palco = document.getElementById('palco');
  if (palco) {
    let faixa = { topo: 0, altura: 200 };
    const cards    = [...palco.querySelectorAll('.catcard')];
    const trilho   = document.getElementById('palcoCarrossel');
    const fantasma = document.getElementById('palcoFantasma');
    const elNome   = document.getElementById('palcoNome');
    const elLinha  = document.getElementById('palcoLinha');
    const elConta  = document.getElementById('palcoConta');
    const elIr     = document.getElementById('palcoIr');
    const marca    = palco.querySelector('.palco__marca');
    const total    = cards.length;
    let indice = 0, girando = false, arrastou = false, pendente = 0, relogioGira = 0;
    const raizDoc = document.documentElement;
    /* Lê a duração do próprio CSS em vez de repetir o número aqui. Assim a
       troca mais curta do celular vale pros dois lados, e continua valendo
       se a tela mudar de tamanho no meio do caminho. */
    const troca = () => {
      if (reduced) return 0;
      const v = getComputedStyle(raizDoc).getPropertyValue('--t-troca').trim();
      const n = parseFloat(v) || 0.42;
      return v.endsWith('ms') ? n : n * 1000;
    };
    const dcatEl = document.getElementById('dcat');
    let aplicaFundo = () => {};

    /* O nome de trás precisa ocupar quase toda a largura, e 'wraps' não cabe
       no mesmo corpo que 'sanduíche artesanal'. Uma régua fora da tela mede o
       texto num corpo conhecido e o resto é regra de três — medir no próprio
       elemento não serve, porque ele é largo demais e scrollWidth devolveria
       a largura da caixa, não a da palavra. */
    const BASE = 100;
    const regua = document.createElement('span');
    regua.setAttribute('aria-hidden', 'true');
    palco.appendChild(regua);

    /* nome de duas palavras vai em duas linhas: numa linha só, 'sanduíche
       artesanal' caía pra 134px enquanto 'açaí' ficava em 344px, e a palavra
       de trás perdia o peso que ela tem que ter. Em duas linhas o bloco ocupa
       sempre mais ou menos a mesma mancha. */
    const quebra = (txt) => {
      const palavras = txt.split(' ');
      if (palavras.length < 2) return [txt];
      const meio = Math.ceil(palavras.length / 2);
      return [palavras.slice(0, meio).join(' '), palavras.slice(meio).join(' ')];
    };

    const cabe = (txt) => {
      const cs = getComputedStyle(fantasma);
      regua.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;' +
        'white-space:nowrap;pointer-events:none;letter-spacing:-.022em;' +
        'font-family:' + cs.fontFamily + ';font-weight:' + cs.fontWeight + ';font-size:' + BASE + 'px';
      /* Uma linha ou duas? Depende da faixa. Com faixa alta, 'sanduíche
         artesanal' fica maior quebrado em dois; com faixa baixa, a altura
         é que aperta e a linha única sai maior. Em vez de escolher na mão,
         calcula os dois e fica com o que der letra maior. */
      const larguraDe = (ls) => {
        let maior = 0;
        for (const l of ls) { regua.textContent = l; maior = Math.max(maior, regua.offsetWidth); }
        return maior;
      };
      const opcoes = [[txt]];
      if (txt.indexOf(' ') > 0) opcoes.push(quebra(txt));

      let linhas = null, corpo = 0;
      for (const ls of opcoes) {
        const larg = larguraDe(ls);
        if (!larg) continue;
        const porLargura = palco.clientWidth * 0.92 / larg * BASE;
        /* tinta de n linhas ≈ (n-1) caixas de linha + uma altura de letra */
        const porAltura = faixa.altura / ((ls.length - 1) * 0.86 + 1.24);
        const tam = Math.min(porLargura, porAltura);
        if (tam > corpo) { corpo = tam; linhas = ls; }
      }
      if (!linhas) return;
      fantasma.style.fontSize = corpo.toFixed(1) + 'px';
      fantasma.textContent = '';
      for (const l of linhas) {
        const s = document.createElement('span');
        s.textContent = l;
        fantasma.appendChild(s);
      }

      /* A caixa de linha mente: com line-height .86 a letra passa bem por fora
         dela, e num notebook baixo (1024x600) o "s" de saladas subia até tocar
         a etiqueta do canto. Então mede a tinta de verdade e corrige. */
      const tinta = () => {
        const rs = [...fantasma.querySelectorAll('span')].map((s) => {
          const r = document.createRange();
          r.selectNodeContents(s);
          return r.getBoundingClientRect();
        });
        return {
          topo: Math.min(...rs.map(r => r.top)),
          alto: Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top)),
        };
      };

      /* O nome não pode mais encostar no card: quando a foto entrar ali, ela
         taparia a palavra. Então ele é obrigado a caber na faixa livre entre a
         etiqueta do canto e o topo do card do meio — medida em offsetTop, que
         ignora o transform da animação de entrada. */
      let t = tinta();
      if (t.alto > faixa.altura) {
        corpo = corpo * faixa.altura / t.alto;
        fantasma.style.fontSize = corpo.toFixed(1) + 'px';
        t = tinta();
      }
      fantasma.style.top = '';
      t = tinta();
      const subiu = t.topo - fantasma.getBoundingClientRect().top;   /* transformações se cancelam */
      const falta = faixa.topo - (fantasma.offsetTop + subiu);
      if (Math.abs(falta) > 1) fantasma.style.top = (fantasma.offsetTop + falta).toFixed(1) + 'px';
    };

    /* troca a palavra com ela já invisível: sai por um lado, volta pelo outro */
    const trocaFantasma = (txt, sentido) => {
      if (fantasma.textContent.replace(/\s+/g, ' ').trim() === txt) { cabe(txt); return; }
      if (reduced) { cabe(txt); return; }
      palco.style.setProperty('--saida', sentido > 0 ? '-6%' : '6%');
      palco.classList.add('is-trocando');
      setTimeout(() => {
        fantasma.style.transition = 'none';
        palco.style.setProperty('--saida', sentido > 0 ? '6%' : '-6%');
        cabe(txt);
        void fantasma.offsetWidth;          /* fixa o salto antes de soltar */
        fantasma.style.transition = '';
        palco.classList.remove('is-trocando');
      }, 130);
    };

    const papel = (i) => {
      const d = (i - indice + total) % total;
      if (d === 0) return 'centro';
      if (d === 1) return 'dir';
      if (d === total - 1) return 'esq';
      if (d === 2) return 'fundo';
      return 'fora';
    };

    const desenha = (sentido) => {
      cards.forEach((c, i) => {
        const p = papel(i);
        c.dataset.papel = p;
        c.tabIndex = p === 'fora' ? -1 : 0;
        c.inert = p === 'fora';
        c.setAttribute('aria-current', p === 'centro' ? 'true' : 'false');
        c.setAttribute('aria-label', p === 'centro'
          ? c.dataset.nome + ' — categoria em destaque, abre no cardápio'
          : 'Trazer ' + c.dataset.nome + ' para a frente');
      });
      const alvo = cards[indice];
      palco.style.backgroundColor = alvo.dataset.cor;
      aplicaFundo();
      elNome.textContent  = alvo.dataset.nome;
      elLinha.textContent = alvo.dataset.linha;
      elConta.textContent = String(indice + 1).padStart(2, '0');
      elIr.setAttribute('href', alvo.dataset.alvo);
      elIr.setAttribute('aria-label', 'Ver ' + alvo.dataset.nome + ' no cardápio');
      trocaFantasma(alvo.dataset.nome, sentido);
    };

    const gira = (passo) => {
      if (!passo || palcoCena() !== 'vitrine') return;
      /* Um pedido que chega no meio da troca era simplesmente descartado, e
         quem passa três categorias de uma vez via a terceira sumir. Guardar
         o último e aplicar assim que a trava solta faz o carrossel
         acompanhar o dedo em vez de ignorá-lo. */
      if (girando) { pendente = Math.max(-4, Math.min(4, pendente + passo)); return; }
      girando = true;
      indice = ((indice + passo) % total + total) % total;
      desenha(passo > 0 ? 1 : -1);
      clearTimeout(relogioGira);
      relogioGira = setTimeout(() => {
        girando = false;
        /* um degrau por vez: quem deu três swipes vê as três categorias
           passarem, em vez de um salto seco de três de uma vez */
        if (pendente) { const p = pendente > 0 ? 1 : -1; pendente -= p; gira(p); }
      }, troca());
    };

    /* o clique é na categoria, não numa seta */
    trilho.addEventListener('click', (e) => {
      if (arrastou) { arrastou = false; return; }
      const card = e.target.closest('.catcard');
      if (!card) return;
      const p = card.dataset.papel;
      if (p === 'esq')   return gira(-1);
      if (p === 'dir')   return gira(+1);
      if (p === 'fundo') return gira(+2);
      if (p === 'centro') palcoAbre(cards.indexOf(card));
    });

    /* dedo (ou mouse) arrastando pro lado */
    let x0 = 0, y0 = 0, seguindo = false;
    trilho.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      seguindo = true; arrastou = false;
      x0 = e.clientX; y0 = e.clientY;
    });
    addEventListener('pointermove', (e) => {
      if (!seguindo) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      /* se o movimento é mais vertical que horizontal, é rolagem de página */
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) { seguindo = false; return; }
      /* 48px é meio centímetro de dedo antes de qualquer resposta — no
         toque isso lê como travamento. Com mouse o limiar alto continua
         valendo, pra arrasto acidental não virar troca de categoria. */
      const limiar = matchMedia('(pointer:fine)').matches ? 48 : 28;
      if (Math.abs(dx) < limiar) return;
      seguindo = false; arrastou = true;
      gira(dx < 0 ? +1 : -1);
    });
    addEventListener('pointerup',     () => { seguindo = false; });
    addEventListener('pointercancel', () => { seguindo = false; arrastou = false; });

    palco.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); gira(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); gira(+1); }
    });

    /* uma foto colocada depois desliga o desenho de espera sozinha. Se o
       arquivo não existir, cai de volta na moldura tracejada em vez de
       mostrar o ícone de imagem quebrada — e tenta .png antes de desistir. */
    palco.querySelectorAll('.catcard__foto').forEach((f) => {
      const img = f.querySelector('img');
      if (!img) return;
      f.classList.add('tem-foto');
      const falhou = () => {
        if (!img.dataset.tentouPng && /\.jpe?g$/i.test(img.getAttribute('src') || '')) {
          img.dataset.tentouPng = '1';
          img.src = img.getAttribute('src').replace(/\.jpe?g$/i, '.png');
          return;
        }
        img.remove();
        f.classList.remove('tem-foto');
      };
      img.addEventListener('error', falhou);
      /* o 404 pode ter acontecido antes deste script rodar: aí o evento já
         passou e nunca mais dispara. Checa o estado na mão também. */
      if (!img.dataset.src && img.complete && img.naturalWidth === 0) falhou();
    });

    /* Fundo de categoria: só entra depois que a imagem carregou de verdade.
       CSS não sabe avisar que um background-image deu 404 — ficaria a cor
       chapada sem ninguém perceber que a foto não existe. */
    const fundos = new Map();
    const pedidos = new Set();

    /* São nove fotos grandes: baixar as nove de uma vez custaria uns 2,5 MB
       logo na entrada, e o visitante pode nunca passar da primeira. Baixa a
       da categoria aberta na hora e o resto quando a linha estiver livre. */
    /* A deriva das camadas só roda com o palco em cena: animar duas superfícies
       desfocadas do tamanho da tela fora da vista é GPU jogada fora. Teste de
       retângulo no scroll, igual ao resto do arquivo — IntersectionObserver
       depende do ciclo de render e não entrega nada com a aba em segundo
       plano, o que deixava a animação parada. */
    /* "perto" é uma tela e meia antes: dá tempo de a foto chegar sem que ela
       dispute banda com o hero, que é o que o visitante está olhando. */
    const pertoDeEntrar = () => {
      const r = palco.getBoundingClientRect();
      return r.top < innerHeight * 1.6 && r.bottom > -innerHeight * 0.6;
    };
    const noAr = () => {
      const r = palco.getBoundingClientRect();
      palco.classList.toggle('no-ar', r.bottom > -innerHeight * 0.1 && r.top < innerHeight * 1.1);
      if (pertoDeEntrar()) aplicaFundo();
    };
    noAr();
    addEventListener('scroll', noAr, { passive: true });
    addEventListener('resize', noAr);

    const carregaFundo = (card) => {
      const caminho = card && card.dataset.fundo;
      if (!caminho || pedidos.has(card)) return;
      pedidos.add(card);
      /* Ordem de preferência, e cai pro seguinte se algum não existir. O
         .jpg no fim é a rede de segurança de quem não lê WebP — e é também
         o que prova que a imagem existe, já que CSS não avisa 404 nenhum. */
      const base = caminho.replace(/\.jpe?g$/i, '');
      const fila = innerWidth < 900
        ? [base + '-900.webp', base + '.webp', caminho]
        : [base + '.webp', caminho];
      const tenta = (i) => {
        if (i >= fila.length) return;
        const teste = new Image();
        teste.onload = () => { fundos.set(card, fila[i]); aplicaFundo(); };
        teste.onerror = () => tenta(i + 1);
        teste.src = fila[i];
      };
      tenta(0);
    };

    /* só o que pode entrar em cena: a categoria aberta agora e as duas
       vizinhas, que são o próximo passo do carrossel. As outras seis esperam
       a vez — juntas passam de 2 MB, e a maioria dos visitantes nunca chega
       nelas. */
    const folga = (fn) => ('requestIdleCallback' in window)
      ? requestIdleCallback(fn, { timeout: 4000 })
      : setTimeout(fn, 1500);

    aplicaFundo = () => {
      /* Nada de foto enquanto a seção está longe: no primeiro quadro a
         vitrine fica a três telas de distância e o visitante ainda está no
         hero. Sem esta trava, 865 kB de banner chegavam antes da primeira
         rolagem — medido. */
      if (pertoDeEntrar()) {
        /* promove as capas junto: o data-src existe justamente pra elas nao
           saírem na frente do hero */
        palco.querySelectorAll("source[data-srcset]").forEach((s) => {
          s.srcset = s.dataset.srcset;
          s.removeAttribute("data-srcset");
        });
        palco.querySelectorAll("img[data-src]").forEach((i) => {
          i.src = i.dataset.src;
          i.removeAttribute("data-src");
        });
        carregaFundo(cards[indice]);
        folga(() => palco
          .querySelectorAll('.catcard[data-papel="esq"], .catcard[data-papel="dir"]')
          .forEach(carregaFundo));
      }
      const url = fundos.get(cards[indice]);
      raizDoc.style.setProperty('--fundo-cat', url ? 'url("' + new URL(url, location.href).href + '")' : 'none');
      palco.classList.toggle('tem-fundo', !!url);
      dcatEl.classList.toggle('tem-fundo', !!url);
    };

    /* A faixa é sempre a mesma, seja qual for a categoria: o papel "centro"
       tem geometria fixa. Medir uma vez (com o movimento desligado, senão a
       transição de altura devolve um valor no meio do caminho) e de novo a
       cada resize. */
    const medeFaixa = () => {
      const maisAlto = Math.min(...cards.map(c => c.offsetTop));
      const topo = marca.offsetTop + marca.offsetHeight + 16;
      /* folga generosa entre a palavra e o card: com 14px fixos o rabo do 'ç'
         encostava na moldura e parecia colado. Cresce junto com a tela. */
      const respiro = Math.min(70, Math.max(30, palco.clientHeight * 0.058));
      faixa = { topo, altura: Math.max(70, maisAlto - respiro - topo) };
    };

    palco.classList.add('sem-mov');
    desenha(1);
    medeFaixa();
    cabe(cards[0].dataset.nome);
    const soltaMovimento = () => palco.classList.remove('sem-mov');
    requestAnimationFrame(soltaMovimento);
    setTimeout(soltaMovimento, 200);   /* aba em segundo plano não roda rAF */

    addEventListener('resize', () => { medeFaixa(); cabe(cards[indice].dataset.nome); });
    if (document.fonts && document.fonts.ready) {
      /* a Fredoka chega depois do primeiro desenho e muda a largura do nome */
      document.fonts.ready.then(() => { medeFaixa(); cabe(cards[indice].dataset.nome); });
    }

    /* =====================================================================
       CARDÁPIO ABERTO — vitrine → entrando → detalhe → saindo → vitrine
       =====================================================================
       Mesmo desenho de estados da referência: a transição não pode ser
       disparada por cima de outra, o Escape volta, e o foco sabe pra onde
       voltar. Quem cresce é uma superfície de cor (.morfo), não o conteúdo:
       escalar texto o deixa borrado no meio do caminho. */
    /* a "capa" é o próprio palco: recuar é apagar os filhos dele */
    const morfo  = document.getElementById('morfo');
    const dcat   = document.getElementById('dcat');
    const dNome  = document.getElementById('dcatNome');
    const dLinha = document.getElementById('dcatLinha');
    const dConta = document.getElementById('dcatConta');
    const dAviso = document.getElementById('dcatAviso');
    const dCorpo = document.getElementById('dcatCorpo');
    const pista  = document.querySelector('.dtrilho__pista');
    const pilulas = [...document.querySelectorAll('.dtrilho__pil')];
    const grupos  = cards.map(c => document.querySelector(c.dataset.alvo));
    const raiz    = document.documentElement;
    /* dois tempos, não um: a trava só existe pra impedir que uma transição
       seja disparada por cima da outra, e sair pode ser mais curto que
       entrar. Cada número é o da transição correspondente no CSS. */
    const ENTRA = reduced ? 0 : 400;   /* .morfo cresce em .38s */
    const SAI   = reduced ? 0 : 320;   /* .morfo encolhe em .3s  */

    const miolo = document.querySelector('main');
    const dock  = document.querySelector('.dock');
    grupos.forEach(g => { g.hidden = true; });

    let cena = 'vitrine', voltaPara = null, relogio = 0;

    const cantoDoCard = (card) => getComputedStyle(card.querySelector('.catcard__foto')).borderRadius;

    const poeNoLugar = (r, canto) => {
      morfo.style.left = r.left + 'px';
      morfo.style.top = r.top + 'px';
      morfo.style.width = r.width + 'px';
      morfo.style.height = r.height + 'px';
      morfo.style.borderRadius = canto;
    };

    const pintaDetalhe = (i) => {
      const c = cards[i];
      raiz.style.setProperty('--dcat-cor', c.dataset.cor);
      aplicaFundo();
      dNome.textContent = c.dataset.nome;
      dLinha.textContent = c.dataset.linha;
      dConta.textContent = String(i + 1).padStart(2, '0');
      grupos.forEach((g, k) => { g.hidden = k !== i; });
      pilulas.forEach((b, k) => {
        b.classList.toggle('is-ativa', k === i);
        b.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      /* centraliza a pílula na mão: scrollIntoView aqui puxaria a página */
      const b = pilulas[i];
      if (b) pista.scrollTo({ left: b.offsetLeft - (pista.clientWidth - b.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
      dCorpo.scrollTop = 0;
      dAviso.textContent = 'Categoria ' + c.dataset.nome + ' aberta.';
    };

    const abre = (i) => {
      if (cena !== 'vitrine') return;
      cena = 'entrando';
      voltaPara = document.activeElement;
      if (i !== indice) { indice = i; desenha(1); }
      pintaDetalhe(i);

      const card = cards[i];
      const r = card.getBoundingClientRect();
      morfo.classList.remove('recolhe');
      morfo.style.transition = 'none';
      poeNoLugar(r, cantoDoCard(card));
      morfo.classList.add('is-on');
      void morfo.offsetWidth;
      morfo.style.transition = '';
      morfo.style.left = '0px'; morfo.style.top = '0px';
      morfo.style.width = '100%'; morfo.style.height = '100%';
      morfo.style.borderRadius = '0px';

      palco.classList.add('recuou');
      raiz.classList.add('travado');
      document.body.classList.add('cat-aberta');
      dcat.classList.add('is-aberto');
      dcat.setAttribute('aria-hidden', 'false');
      /* nada atrás do painel pode receber Tab enquanto ele está aberto */
      miolo.inert = true; if (dock) dock.inert = true;

      clearTimeout(relogio);
      relogio = setTimeout(() => {
        cena = 'detalhe';
        dcat.focus({ preventScroll: true });
      }, ENTRA);
    };

    const fecha = () => {
      if (cena !== 'detalhe') return;
      cena = 'saindo';
      dcat.classList.remove('is-aberto');
      dcat.setAttribute('aria-hidden', 'true');
      palco.classList.remove('recuou');
      raiz.classList.remove('travado');

      const card = cards[indice];
      const r = card.getBoundingClientRect();
      morfo.classList.add('recolhe');
      poeNoLugar(r, cantoDoCard(card));

      clearTimeout(relogio);
      relogio = setTimeout(() => {
        morfo.classList.remove('is-on');
        document.body.classList.remove('cat-aberta');
        miolo.inert = false; if (dock) dock.inert = false;
        cena = 'vitrine';
        /* body.focus() não faz nada e o foco ficava preso no painel que
           acabou de sumir: só vale voltar pra algo que aceite foco */
        const serve = (el) => el && el.isConnected && el !== document.body && el.tabIndex >= 0;
        const volta = serve(voltaPara) ? voltaPara : document.getElementById('palcoIr');
        volta.focus({ preventScroll: true });
        dAviso.textContent = 'Voltou para as categorias.';
      }, SAI);
    };

    /* trocar de categoria sem sair: só o conteúdo pisca, a tela fica */
    const pula = (i) => {
      if (cena !== 'detalhe' || i === indice) return;
      indice = i;
      desenha(1);              /* a vitrine atrás fica no mesmo lugar */
      pintaDetalhe(i);
    };

    document.getElementById('palcoIr').addEventListener('click', () => abre(indice));
    document.getElementById('dcatVoltar').addEventListener('click', fecha);
    pilulas.forEach((b, i) => b.addEventListener('click', () => pula(i)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && cena === 'detalhe') fecha(); });

    /* deixa o resto do motor enxergar o estado */
    palcoAbre = abre;
    palcoCena = () => cena;
  }

  /* ---------- carrinho ----------
     Estado simples: uma lista de {id, nome, preço, qtd} guardada no
     localStorage, para o pedido sobreviver a um refresh no meio da escolha.
     Nada é cobrado aqui — o site só monta a mensagem e entrega pro WhatsApp. */
  const CHAVE_PEDIDO = 'love-acai-pedido';
  const ZAP = '5585994077570';
  const canalZap = document.getElementById('canalZap');
  const ZAP_ENTREGA = canalZap ? canalZap.href : '';

  const elCarrinho  = document.getElementById('carrinho');
  const elItens     = document.getElementById('carrinhoItens');
  const elConta     = document.getElementById('carrinhoConta');
  const elBarraTot  = document.getElementById('carrinhoBarraTotal');
  const elSubtotal  = document.getElementById('carrinhoSubtotal');
  const elFinalizar = document.getElementById('carrinhoFinalizar');
  const elObs       = document.getElementById('carrinhoObs');
  const btnAbre     = document.getElementById('carrinhoAbre');
  const btnFecha    = document.getElementById('carrinhoFecha');
  const elVeu       = document.getElementById('carrinhoVeu');
  const areaProdutos = document.getElementById('dcatCorpo');

  let pedido = [];
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_PEDIDO));
    if (Array.isArray(guardado)) pedido = guardado.filter(i => i && i.id && typeof i.preco === 'number' && i.qtd > 0);
  } catch (e) { pedido = []; }

  const dinheiro = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const somaTotal = () => pedido.reduce((s, i) => s + i.preco * i.qtd, 0);
  const somaItens = () => pedido.reduce((s, i) => s + i.qtd, 0);
  const guarda = () => { try { localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido)); } catch (e) {} };

  const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();

  /* o omelete muda de identidade conforme a proteína escolhida */
  const escolhaDo = (card) => card.querySelector('.escolha__pill[aria-checked="true"]');
  const idDoCard = (card) => {
    const p = escolhaDo(card);
    return p ? card.dataset.id + '--' + semAcento(p.dataset.valor) : card.dataset.id;
  };
  const nomeDoCard = (card) => {
    const p = escolhaDo(card);
    return p ? card.dataset.nome + ' (salada de ' + p.dataset.valor + ')' : card.dataset.nome;
  };

  const cards = [...document.querySelectorAll('.produto[data-id]')];
  const sincronizaCards = () => {
    cards.forEach((card) => {
      const item = pedido.find(i => i.id === idDoCard(card));
      const add = card.querySelector('.produto__add');
      const stepper = card.querySelector('.stepper');
      if (!add || !stepper) return;
      add.hidden = !!item;
      stepper.hidden = !item;
      if (item) stepper.querySelector('.stepper__valor').textContent = item.qtd;
    });
  };

  const montaLink = () => {
    const linhas = pedido.map(i => '• ' + i.qtd + 'x ' + i.nome + ' — ' + dinheiro(i.preco * i.qtd));
    const obs = (elObs.value || '').trim();
    const texto = 'Oi! Quero fazer um pedido 💜\n\n' +
      linhas.join('\n') +
      '\n\nTotal: ' + dinheiro(somaTotal()) +
      (obs ? '\n\nObservação: ' + obs : '');
    elFinalizar.href = 'https://wa.me/' + ZAP + '?text=' + encodeURIComponent(texto);
    /* quem montou o pedido e desceu até o delivery não deve ter que voltar:
       o card grande de lá leva o mesmo pedido escrito. Carrinho vazio, ele
       volta a ser a pergunta genérica sobre entrega. */
    if (canalZap) canalZap.href = pedido.length ? elFinalizar.href : ZAP_ENTREGA;
  };

  const pinta = () => {
    /* quem estava com o foco numa linha da gaveta não pode perdê-lo quando a
       lista é redesenhada — guarda a posição e devolve depois */
    const focado = document.activeElement;
    let devolver = null;
    if (focado && elItens.contains(focado)) {
      const li = focado.closest('.carrinho__item');
      if (li) devolver = {
        id: li.dataset.id,
        papel: focado.hasAttribute('data-mais') ? 'mais'
             : focado.hasAttribute('data-menos') ? 'menos' : 'remover',
      };
    }

    const n = somaItens();
    elConta.textContent = n;
    elBarraTot.textContent = dinheiro(somaTotal());
    elSubtotal.textContent = dinheiro(somaTotal());
    elCarrinho.classList.toggle('is-ativo', n > 0);
    elCarrinho.classList.toggle('is-vazio', n === 0);

    elItens.textContent = '';
    pedido.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'carrinho__item';
      li.dataset.id = item.id;
      li.innerHTML =
        '<div class="carrinho__item-info">' +
          '<p class="carrinho__item-nome"></p>' +
          '<span class="carrinho__item-preco"></span>' +
        '</div>' +
        '<div class="stepper">' +
          '<button type="button" data-menos aria-label="Diminuir">−</button>' +
          '<span class="stepper__valor"></span>' +
          '<button type="button" data-mais aria-label="Aumentar">+</button>' +
        '</div>' +
        '<button class="carrinho__item-remover" type="button">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>';
      li.querySelector('.carrinho__item-nome').textContent = item.nome;
      li.querySelector('.carrinho__item-preco').textContent = dinheiro(item.preco) + ' cada';
      li.querySelector('.stepper__valor').textContent = item.qtd;
      li.querySelector('.carrinho__item-remover').setAttribute('aria-label', 'Remover ' + item.nome);
      elItens.appendChild(li);
    });

    if (devolver) {
      const li = elItens.querySelector('[data-id="' + CSS.escape(devolver.id) + '"]');
      if (li) {
        const alvo = devolver.papel === 'remover'
          ? li.querySelector('.carrinho__item-remover')
          : li.querySelector('[data-' + devolver.papel + ']');
        if (alvo) alvo.focus();
      }
    }

    sincronizaCards();
    montaLink();
  };

  const muda = (id, delta, card) => {
    const existente = pedido.find(i => i.id === id);
    if (existente) {
      existente.qtd += delta;
      if (existente.qtd <= 0) pedido = pedido.filter(i => i.id !== id);
    } else if (delta > 0 && card) {
      pedido.push({ id, nome: nomeDoCard(card), preco: parseFloat(card.dataset.preco), qtd: 1 });
    }
    guarda();
    pinta();
  };

  function abreCarrinho(aberto) {
    elCarrinho.classList.toggle('is-aberto', aberto);
    btnAbre.setAttribute('aria-expanded', String(aberto));
    if (aberto) btnFecha.focus();
    else if (somaItens() > 0) btnAbre.focus();
  }

  if (areaProdutos) {
    areaProdutos.addEventListener('click', (e) => {
      const card = e.target.closest('.produto[data-id]');
      if (!card) return;

      const pilula = e.target.closest('.escolha__pill');
      if (pilula) {
        card.querySelectorAll('.escolha__pill')
          .forEach(p => p.setAttribute('aria-checked', String(p === pilula)));
        const add = card.querySelector('.produto__add');
        add.disabled = false;
        add.textContent = 'adicionar';
        sincronizaCards();
        return;
      }

      const add = e.target.closest('.produto__add');
      // a delegação não herda a trava do botão: checa na mão
      if (add) return add.disabled ? undefined : muda(idDoCard(card), +1, card);
      if (e.target.closest('[data-mais]'))    return muda(idDoCard(card), +1, card);
      if (e.target.closest('[data-menos]'))   return muda(idDoCard(card), -1, card);
    });
  }

  elItens.addEventListener('click', (e) => {
    const li = e.target.closest('.carrinho__item');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.closest('.carrinho__item-remover')) {
      pedido = pedido.filter(i => i.id !== id);
      guarda(); pinta();
      return;
    }
    if (e.target.closest('[data-mais]'))  return muda(id, +1);
    if (e.target.closest('[data-menos]')) return muda(id, -1);
  });

  btnAbre.addEventListener('click', () => abreCarrinho(!elCarrinho.classList.contains('is-aberto')));
  btnFecha.addEventListener('click', () => abreCarrinho(false));
  elVeu.addEventListener('click', () => abreCarrinho(false));
  elObs.addEventListener('input', montaLink);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elCarrinho.classList.contains('is-aberto')) abreCarrinho(false);
  });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      arrasta(); revela(); desliza(); marcaZona(); cuidaDosReels();
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);


  /* ---------- como chegar ----------
     A distância é calculada aqui dentro, com a coordenada da loja que está
     no próprio <section>. A posição do visitante não vai pra lugar nenhum:
     entra pelo navegador, vira um número e morre na página. O botão de rota
     também não carrega coordenada — manda nome e endereço e deixa o Google
     resolver com o dado dele, que é melhor que o meu.

     Em linha reta, e dito assim na tela: prometer "12 minutos de moto" sem
     serviço de rota seria inventar. */
  const secaoMapa = document.getElementById('mapa');
  if (secaoMapa) {
    const btnPerto = document.getElementById('mapaPerto');
    const saida = document.getElementById('mapaSaida');
    const LAT = parseFloat(secaoMapa.dataset.lat);
    const LON = parseFloat(secaoMapa.dataset.lon);

    const kmAte = (lat, lon) => {
      const R = 6371, rad = Math.PI / 180;
      const a = Math.sin((lat - LAT) * rad / 2) ** 2 +
                Math.cos(LAT * rad) * Math.cos(lat * rad) * Math.sin((lon - LON) * rad / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    };

    const escreve = (txt) => { saida.textContent = txt; };

    btnPerto.addEventListener('click', () => {
      if (!navigator.geolocation) {
        escreve('Seu navegador não sabe dizer onde você está — mas a rota ali do lado funciona.');
        return;
      }
      btnPerto.disabled = true;
      escreve('procurando você…');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const km = kmAte(pos.coords.latitude, pos.coords.longitude);
          const quanto = km < 1
            ? Math.round(km * 1000) + ' metros'
            : km.toFixed(1).replace('.', ',') + ' km';
          escreve('Você está a cerca de ' + quanto + ' daqui, em linha reta.');
          btnPerto.disabled = false;
        },
        (erro) => {
          escreve(erro.code === 1
            ? 'Tudo bem não compartilhar — a rota ali do lado funciona do mesmo jeito.'
            : 'Não consegui te localizar agora. Tenta pela rota ali do lado.');
          btnPerto.disabled = false;
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  /* ---------- rolagem suave para as âncoras ---------- */
  document.querySelectorAll('[data-ir]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const destino = document.querySelector(el.getAttribute('href'));
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      setMenu(false);
      abreCarrinho(false);
    });
  });

  arrasta(); revela(); desliza(); marcaZona(); cuidaDosReels(); pinta();
})();
