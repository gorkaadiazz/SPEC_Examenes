// Calculadora de subredes IPv4 y conversor de bases (sección 5.2). Puro.

/** "192.168.1.10" -> número de 32 bits (o null si no es una IP válida). */
export function ipANumero(ip) {
  const partes = String(ip).trim().split('.');
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export function numeroAIp(n) {
  return [24, 16, 8, 0].map((d) => Math.floor(n / 2 ** d) % 256).join('.');
}

/** Máscara de un prefijo (/24 -> 255.255.255.0) como número. */
const mascaraDe = (cidr) => (cidr === 0 ? 0 : 2 ** 32 - 2 ** (32 - cidr));

/** "255.255.255.0" -> 24 (null si no es una máscara válida). */
export function cidrDeMascara(mascara) {
  const n = ipANumero(mascara);
  if (n == null) return null;
  for (let c = 0; c <= 32; c++) if (mascaraDe(c) === n) return c;
  return null;
}

/**
 * Interpreta "192.168.1.10/24", "192.168.1.10 255.255.255.0" o IP + máscara aparte.
 * @returns {{ip:number, cidr:number}}  (lanza Error con un mensaje claro si está mal)
 */
export function interpretar(texto, mascara = '') {
  const [ipTxt, resto] = String(texto).trim().split(/[\/\s]+/);
  const ip = ipANumero(ipTxt);
  if (ip == null) throw new Error('La IP no es válida. Ejemplo: 192.168.1.10/24');
  const m = (resto ?? mascara ?? '').toString().trim().replace(/^\//, '');
  if (!m) throw new Error('Falta la máscara o el prefijo (por ejemplo /24).');
  const cidr = /^\d{1,2}$/.test(m) ? Number(m) : cidrDeMascara(m);
  if (cidr == null || cidr < 0 || cidr > 32) throw new Error('La máscara no es válida. Usa /0 a /32 o algo como 255.255.255.0');
  return { ip, cidr };
}

/** Datos de la red a la que pertenece una IP. */
export function red(ip, cidr) {
  const mascara = mascaraDe(cidr);
  const tam = 2 ** (32 - cidr);
  const direccion = Math.floor(ip / tam) * tam;
  const broadcast = direccion + tam - 1;
  // /31 (enlaces punto a punto) y /32 (un solo equipo) no reservan red ni broadcast
  const hosts = cidr >= 31 ? tam : tam - 2;
  return {
    cidr,
    red: numeroAIp(direccion),
    mascara: numeroAIp(mascara),
    wildcard: numeroAIp(2 ** 32 - 1 - mascara),
    broadcast: numeroAIp(broadcast),
    primerHost: numeroAIp(cidr >= 31 ? direccion : direccion + 1),
    ultimoHost: numeroAIp(cidr >= 31 ? broadcast : broadcast - 1),
    hosts,
    _direccion: direccion,
    _tam: tam,
  };
}

/** Divide una red en `n` subredes iguales (redondea a la potencia de 2). */
export function dividir(ip, cidr, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('Indica cuántas subredes quieres.');
  const bits = Math.ceil(Math.log2(n));
  const nuevo = cidr + bits;
  if (nuevo > 30) throw new Error('No caben tantas subredes en esa red.');
  const base = red(ip, cidr)._direccion;
  const tam = 2 ** (32 - nuevo);
  return Array.from({ length: 2 ** bits }, (_, i) => red(base + i * tam, nuevo));
}

/**
 * VLSM: reparte una red en subredes del tamaño justo para cada nº de hosts.
 * @param {number[]} hosts  hosts que necesita cada subred
 * @returns {Array<{pedidos:number} & ReturnType<typeof red>>} de mayor a menor
 */
export function vlsm(ip, cidr, hosts) {
  const pedidos = hosts.filter((x) => Number.isInteger(x) && x > 0).sort((a, b) => b - a);
  if (!pedidos.length) throw new Error('Escribe los hosts de cada subred, separados por comas.');
  const total = red(ip, cidr);
  let siguiente = total._direccion;
  const fin = total._direccion + total._tam;
  return pedidos.map((n) => {
    const prefijo = 32 - Math.ceil(Math.log2(n + 2));
    const tam = 2 ** (32 - prefijo);
    if (prefijo < cidr || siguiente + tam > fin) throw new Error(`No caben: la subred de ${n} hosts no entra en lo que queda de la red.`);
    const r = { pedidos: n, ...red(siguiente, prefijo) };
    siguiente += tam;
    return r;
  });
}

/** IP en binario por octetos: "11000000.10101000.00000001.00001010" */
export function ipABinario(ip) {
  const n = typeof ip === 'number' ? ip : ipANumero(ip);
  if (n == null) return null;
  return numeroAIp(n).split('.').map((o) => Number(o).toString(2).padStart(8, '0')).join('.');
}

/**
 * Conversor entre decimal, binario y hexadecimal.
 * @param {'dec'|'bin'|'hex'} base  en qué base está escrito `texto`
 * @returns {{dec:string, bin:string, hex:string}|null} null si no es válido
 */
export function convertir(texto, base) {
  const t = String(texto).trim().replace(/^0[xb]/i, '').replace(/\s+/g, '');
  const reglas = { dec: [/^\d+$/, 10], bin: [/^[01]+$/, 2], hex: [/^[0-9a-f]+$/i, 16] };
  const [patron, raiz] = reglas[base];
  if (!t || !patron.test(t) || t.length > 60) return null;
  // BigInt: admite números de más de 53 bits sin perder precisión
  const n = [...t.toLowerCase()].reduce((a, c) => a * BigInt(raiz) + BigInt(parseInt(c, raiz)), 0n);
  return { dec: n.toString(10), bin: n.toString(2), hex: n.toString(16).toUpperCase() };
}
