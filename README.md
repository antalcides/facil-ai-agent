# 🤖 Fácil con AI Agent — Ciencias & Código

<p align="center">
  <img src="logo.png" alt="Fácil con AI Agent Logo" width="120"/>
</p>

<p align="center">  
  <b>Tu estudio local de ciencias y programación científica -- 100% privado sin suscripción, en local y en la nube.</b>
</p>





<p align="center">
  <img src="https://img.shields.io/badge/Ollama-compatible-blueviolet?style=flat-square" />
  <img src="https://img.shields.io/badge/Python-Pyodide-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/LaTeX-R-Julia-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/licencia-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/offline-100%25-success?style=flat-square" />
</p>

---

## ¿Qué es?

**Fácil con AI Agent** es una interfaz de chat local que conecta con tus modelos de IA instalados en [Ollama](https://ollama.com), directamente desde el navegador. Está orientado a:

- Documentos y artículos en **LaTeX**
- Scripts y análisis en **Python**, **R** y **Julia**
- Resolución de **problemas de ciencias** (matemáticas, física, química, estadística…)
- Proyectos web (HTML/CSS/JS) cuando los necesites

Todo corre en tu máquina: ninguna conversación sale a servidores externos.

---

## ✨ Características

- 💬 **Chat con contexto** — historial completo por sesión
- ⚡ **Streaming** — la respuesta de Ollama aparece en tiempo real
- 🔬🌐 **Selector de modo** — Ciencias (LaTeX/Python/R/Julia) o Web (HTML/CSS/JS)
- 🔄 **Reenviar pregunta** — si falla o cambias de modelo, un botón reintenta sin duplicar el mensaje
- 🎨 **Resaltado de sintaxis** — highlight.js en chat y sandbox (LaTeX, Python, R, Julia, JS…)
- 📐 **LaTeX y matemáticas** — bloques `latex`/`tex` y render KaTeX de fórmulas en el chat
- 🐍 **Python en el navegador** — ejecución real con Pyodide
- 📊 **R y Julia** — generación de scripts listos para RStudio / Julia REPL
- 📋 **Copiar mensaje o respuesta** — botón en cada burbuja
- 📄 **Exportar chat** — a Markdown (`.md`) y a PDF
- 🗂️ **Múltiples sesiones** — sidebar con historial local
- 📎 **Adjuntos** — imágenes y archivos de texto/código (`.tex`, `.py`, `.r`, `.jl`, etc.)
- 🔗 **Lectura de enlaces** — contexto vía Microlink
- 📦 **Exportar proyecto** — descarga código o ZIP multiarchivo
- 🔍 **Gestor de modelos** — instalar y borrar modelos Ollama desde la app
- 🔒 **100% local y privado**

---

## 🚀 Inicio rápido (Windows)

### 1. Instala Ollama

Descarga e instala desde [ollama.com](https://ollama.com/download).

### 2. Descarga un modelo

```bash
ollama pull llama3
# o para código: ollama pull deepseek-coder
# o ligeros: ollama pull phi3 / mistral
```

### 3. Lanza la aplicación

Doble clic en **`Facil_con_AI_Agent_Run.bat`** y elige una opción (todo ocurre en una sola ventana):

| Opción | Qué hace |
|--------|----------|
| **1** LOCAL | Arranca Ollama en segundo plano (sin ventana extra), sirve la app en `http://127.0.0.1:8765` y abre el navegador |
| **2** LOCAL | Igual que 1, asumiendo que Ollama ya está corriendo |
| **3** NUBE | Solo servidor local + navegador (OpenAI, Anthropic, Gemini… no necesita Ollama) |
| **4** | Abre `index.html` directamente (`file://`) |
| **5** | Detiene Ollama |
| **6** | Sale |

Además el script verifica Ollama y configura `OLLAMA_ORIGINS=*`

---

## 🖥️ Uso manual (macOS / Linux)

```bash
export OLLAMA_ORIGINS=*   # o set en Windows
ollama serve
# Luego abre index.html en el navegador
```

---

## 📁 Estructura

```
facil-con-ai-agent/
├── index.html
├── style.css
├── script.js
├── logo.png
└── Facil_con_AI_Agent_Run.bat
```

---

## 🧩 Dependencias (CDN)

| Librería | Uso |
|----------|-----|
| [Pyodide](https://pyodide.org) | Python en el navegador |
| [JSZip](https://stuk.github.io/jszip/) | Empaquetado ZIP |
| [KaTeX](https://katex.org) | Fórmulas matemáticas |
| [highlight.js](https://highlightjs.org) | Resaltado de sintaxis |
| [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) | Exportar chat a PDF |
| [Microlink](https://microlink.io) | Extracción de URLs |

---

## 💡 Ejemplos de prompts

- *«Escribe un artículo LaTeX corto sobre la ecuación de Schrödinger con bibliografía»*
- *«Resuelve paso a paso la integral ∫ x² e^{-x} dx y dame el código en SymPy»*
- *«Script en R con ggplot2 para un histograma de una normal»*
- *«Simulación en Julia de un sistema de Lorenz»*
- *«Documento Beamer de 5 diapositivas sobre redes neuronales»*

---



## 🦊 Zen Browser / Firefox

Zen (y Firefox) son **más estrictos con CORS** que Chrome, sobre todo si abres `index.html` como `file://`.

**Solución recomendada (Windows):**

1. Ejecuta `Facil_con_AI_Agent_Run.bat`
2. Elige **opción 1** (arranca Ollama con `OLLAMA_ORIGINS=*` y abre `http://127.0.0.1:8765`, servidor HTTP local)

También puedes fijar la variable de forma permanente:

```bat
setx OLLAMA_ORIGINS "*"
```

Cierra por completo Ollama (bandeja del sistema → Quit) y vuelve a abrirlo.

Comprueba que `http://127.0.0.1:11434` muestre *Ollama is running*.

## 📄 Licencia

MIT — libre para usar, modificar y distribuir.

---

<p align="center">Adaptado para la comunidad hispanohablante de IA local y ciencias</p>

---
---
El error **HTTP 400 multimodal** significa que la app estaba enviando un campo `images` a Ollama y `deepseek-coder` **no acepta imágenes** (solo texto).

Suele pasar si:
- en esa sesión adjuntaste una imagen (p. ej. `fig-1.png`), o  
- quedó guardado un mensaje con `images` vacío/`[]` en el historial.

### Corrección aplicada
- Solo se envían imágenes si hay base64 real **y** el modelo parece de visión (llava, qwen2-vl, etc.).
- Con `deepseek-coder`, `mistral`, `qwen2.5-coder`, etc. se **elimina** el campo `images` y se avisa en la barra de estado.

**Zip:** **

### Qué hacer tú
1. Sustituye los archivos por los del zip nuevo (o al menos `script.js`).
2. En la app: **➕ Nueva Sesión** (importante: limpia el historial “contaminado” con imágenes).
3. Elige `deepseek-coder:latest` (o `mistral:latest`).
4. Envía el problema **solo como texto**, sin adjuntar la figura (o describe la figura en texto).

Si necesitas que analice la imagen, usa un modelo con visión, por ejemplo:
```bash
ollama pull llava
```
o `llama3.2-vision`, y selecciónalo en el desplegable.

Con sesión nueva + modelo de texto + prompt sin imagen, el 400 multimodal no debería volver a aparecer.

---
---

Gracias funcionó con el modelo multimodal `gemma3:4b` y obtuve la respuesta:

```
Okay, vamos a resolver este problema de movimiento de proyectiles paso a paso.

**Datos iniciales:**

*   Altura inicial (h₀): 125 m
*   Rapidez inicial (v₀): 65.0 m/s
*   Ángulo de lanzamiento (θ): 37.0°
*   Aceleración debido a la gravedad (g): 9.81 m/s²  (Esta es una constante que necesitamos)

**a) Tiempo para alcanzar el suelo (t):**

1.  **Ecuación de movimiento vertical:**  Usaremos la ecuación que describe el movimiento vertical bajo aceleración constante debido a la gravedad:
    `h = h₀ + v₀t - (1/2)gt²`
    Donde:
    *   `h` es la altura final (0 m, ya que el proyectil golpea el suelo)
    *   `h₀` es la altura inicial (125 m)
    *   `v₀` es la velocidad inicial vertical
    *   `g` es la aceleración debido a la gravedad
    *   `t` es el tiempo

2.  **Resolviendo para t:**  En este caso, queremos que `h = 0`.  Reorganizamos la ecuación para resolver para `t`:
    `0 = 125 + v₀t - (1/2)gt²`
    ` (1/2)gt² - v₀t - 125 = 0`

3. **Utilizando la velocidad inicial vertical:** Primero necesitamos convertir el ángulo de 37 grados a una velocidad inicial vertical:
    `v₀y = v₀ * sin(θ) = 65.0 * sin(37.0°) ≈ 40.0 m/s`

4.  Ahora, sustituimos los valores en la ecuación:
    `(1/2) * 9.81 * t² - 40.0 * t - 125 = 0`
    `4.905t² - 40t - 125 = 0`

5.  **Resolviendo la ecuación cuadrática:** Usamos la fórmula cuadrática para resolver para `t`:
     `t = (-b ± √(b² - 4ac)) / 2a`
     Donde a = 4.905, b = -40, c = -125
    `t = (40 ± √((-40)² - 4 * 4.905 * -125)) / (2 * 4.905)`
    `t = (40 ± √(1600 + 2453.5)) / 9.81`
    `t = (40 ± √4053.5) / 9.81`
    `t = (40 ± 63.68) / 9.81`

6.  Obtenemos dos soluciones:
    `t₁ = (40 + 63.68) / 9.81 ≈ 10.71 s`
    `t₂ = (40 - 63.68) / 9.81 ≈ -2.43 s`

7.  **Tomamos la solución positiva:**  El tiempo no puede ser negativo, por lo que tomamos `t ≈ 10.71 s`

**b) Rango del proyectil (X):**

1.  **Ecuación del rango:** La ecuación para el rango (X) de un proyectil es:
    `X = v₀² * sin(2θ) / g`

2.  **Sustituyendo los valores:**
    `X = (65.0)² * sin(2 * 37.0°) / 9.81`
    `X = 4225 * sin(74.0°) / 9.81`
    `X ≈ 4225 * 0.9613 / 9.81`
    `X ≈ 410.1 m`

**c) Componentes de la velocidad en t=10.71s:**

1.  **Velocidad horizontal (vₓ):** La velocidad horizontal es constante (asumiendo que despreciamos la resistencia del aire).
    `vₓ = v₀ * cos(θ) = 65.0 * cos(37.0°) ≈ 58.4 m/s`

2.  **Velocidad vertical (vᴷ) en t=10.71s:**  Calculamos la velocidad vertical en el momento t usando la ecuación:
    `vᴷ = v₀y - gt = 40.0 - 9.81 * 10.71 ≈ 40.0 - 104.4 ≈ -64.4 m/s`
   (El signo negativo indica que la velocidad es hacia abajo)

**d) Magnitud de la velocidad (v):**

1.  **Usamos el teorema de Pitágoras:**  La magnitud de la velocidad es:
    `v = √(vₓ² + vᴷ²) = √((58.4)² + (-64.4)²) ≈ √(3410.56 + 4147.36) ≈ √(7557.92) ≈ 87.0 m/s`

**e) Ángulo formado por el vector velocidad con respecto a la horizontal (α):**

1.  **Usamos la función tangente:**
    `tan(α) = vᴷ / vₓ = -64.4 / 58.4 ≈ -1.098`

2.  **Calculamos el ángulo:**
    `α = arctan(-1.098) ≈ -49.0°`

   (El ángulo es negativo, pero en un problema de proyecciones, generalmente se usa el ángulo en el eje x, que en este caso es -49.0°)

**Resumen de las respuestas:**

*   **a)**  Tiempo para alcanzar el suelo:  t ≈ 10.71 s
*   **b)** Rango del proyectil: X ≈ 410.1 m
*   **c)** Componente horizontal de la velocidad: vₓ ≈ 58.4 m/s; Componente vertical de la velocidad: vᴷ ≈ -64.4 m/s
*   **d)** Magnitud de la velocidad: v ≈ 87.0 m/s
*   **e)** Ángulo formado por el vector velocidad con respecto a la horizontal: α ≈ -49.0° (o 49.0° en el sentido opuesto al eje x)
```
Que me parece muy buena, después busco otro modelo multimodal  entre 4GB y 7GB para comparar.

---
---
Me gustaría la plantilla para tomarla de referencia ya que éste era solo un ejemplo para revisar que hiciera lo que necesito
---

Plantilla de referencia que puedes copiar y adaptar. Está pensada para el modo **🔬 Ciencias** y para modelos locales (con o sin visión).

---

### Plantilla general — problemas de física / ciencias

```text
Actúa como tutor de física (nivel universitario introductorio).

REGLAS:
1. Resuelve SOLO lo que se pide, en el orden de los apartados (a, b, c…).
2. Escribe las ecuaciones en LaTeX ($...$ o $$...$$).
3. Sustituye números solo DESPUÉS de plantear la ecuación simbólica.
4. Usa g = 9.80 m/s² salvo que el problema indique otra cosa.
5. Indica unidades en cada resultado final.
6. Si un dato falta o la figura no es legible, dilo y asume lo mínimo necesario, explicitándolo.
7. NO uses fórmulas válidas solo en casos especiales si este problema no cumple esas condiciones
   (ejemplo: alcance R = v₀² sin(2θ)/g SOLO si el proyectil aterriza a la MISMA altura de lanzamiento).
8. Al final, resume respuestas numéricas en una lista clara.

DATOS (completa o pega del enunciado):
- …
- …

ENUNCIADO:
"""
[pega aquí el texto completo del problema]
"""

[Si hay figura y el modelo es multimodal, adjunta la imagen]
[Si el modelo NO es multimodal, describe la figura en 2–4 líneas]
```

---

### Plantilla específica — movimiento de proyectiles

```text
Problema de MOVIMIENTO DE PROYECTILES. Sigue este esquema:

1) Lista de datos con símbolos (x₀, y₀, v₀, θ, g, …).
2) Componentes: v₀x = v₀ cos θ, v₀y = v₀ sin θ (calcula sin y cos con detalle).
3) Eje vertical: origen y positivo hacia ARRIBA; y = 0 en el suelo (o el nivel que indique el problema).
4) Tiempo de vuelo: resuelve la ecuación cuadrática de y(t) = y_final.
   Quédate solo con t > 0 con sentido físico.
5) Alcance horizontal: X = v₀x · t
   (NO uses R = v₀² sin(2θ)/g si y_final ≠ y_inicial).
6) Velocidad en el impacto: vx = v₀x (constante), vy = v₀y − g t.
7) Magnitud v = √(vx² + vy²) y ángulo α = arctan(vy/vx), indicando si apunta arriba o abajo.

Enunciado:
"""
Un proyectil se dispara desde el extremo de un risco a 125 m sobre el nivel del suelo,
con una rapidez inicial de 65.0 m/s y un ángulo de 37.0° respecto a la horizontal.
a) Tiempo hasta golpear el punto P al nivel del suelo.
b) Rango X desde la base del risco.
c) Componentes horizontal y vertical de la velocidad justo antes de impactar en P.
d) Magnitud de esa velocidad.
e) Ángulo del vector velocidad respecto a la horizontal.
"""
```

---

### Variante corta (cuando ya confías en el modelo)

```text
Proyectil: y₀=125 m, v₀=65 m/s, θ=37°, g=9.80. Aterriza en y=0.
Resuelve a)t b)X=v₀x t c)vx,vy d)|v| e)ángulo.
No uses la fórmula de alcance en suelo plano. Muestra pasos y resultados con 3 cifras significativas.
```

---

### Si adjuntas figura (modelo multimodal)

```text
Analiza la figura adjunta solo para confirmar datos (altura del risco, punto P, ángulo).
Si la figura contradice el texto, prioriza el TEXTO del enunciado y avísame.
Luego resuelve con la plantilla de proyectiles anterior.
```

---

### Si el modelo NO es multimodal

```text
No puedo ver la imagen. Asumo: risco vertical de 125 m, lanzamiento desde el borde,
ángulo 37° sobre la horizontal, punto P en el suelo a distancia X de la base.
Si eso no coincide con la figura, corrígeme los datos antes de calcular.
```

---

Puedes guardar la plantilla larga como nota y solo cambiar el bloque **ENUNCIADO** / datos en cada ejercicio. Si más adelante quieres, se puede integrar como “prompt de sistema” extra al elegir modo Ciencias (plantillas por tema: proyectiles, circuitos, equilibrio, etc.).

---
---

Plantilla de referencia para **simulación y análisis de circuitos eléctricos básicos**, alineada con el modo Ciencias del agente y con ejecución en Python (Pyodide) cuando haga falta.

---

### Plantilla general — circuitos

```text
Actúa como tutor de circuitos eléctricos (nivel introductorio / primer curso).

REGLAS:
1. Resuelve los apartados en orden (a, b, c…).
2. Define polaridades y sentido de corrientes en un diagrama descrito por texto (o ASCII).
3. Escribe leyes en LaTeX: Ohm $V=IR$, KCL, KVL.
4. Primero símbolos, después números. Unidades en el resultado (V, A, Ω, W, s…).
5. Si el circuito es lineal DC, usa: reducción serie/paralelo, divisor de tensión/corriente,
   o sistema de ecuaciones (mallas / nodos). Indica el método.
6. Potencia: $P=VI=I^2R=V^2/R$. Señala si un elemento absorbe o entrega potencia.
7. NO inventes valores. Si falta un dato, dilo.
8. Al final, lista de resultados numéricos.

DATOS:
- Fuente(s): …
- Resistencias: …
- Otros (C, L, si aplica): …

ENUNCIADO:
"""
[pega el problema]
"""

[Si hay esquema y el modelo es multimodal → adjunta la imagen]
[Si no → describe el circuito en texto o ASCII]
```

---

### Plantilla — DC resistivo (serie / paralelo / mixto)

```text
Circuito DC solo resistivo.

1) Dibuja en ASCII nodos y ramas (ejemplo abajo).
2) Identifica series y paralelos; reduce paso a paso hasta Req o I_total si es posible.
3) Si no es reducible solo con serie/paralelo, usa:
   - Mallas (KVL) o
   - Nodos (KCL + Ohm)
4) Obtén corrientes de cada resistencia y tensiones $V_R=IR$.
5) Comprueba: suma de caídas en un lazo = fuentes (KVL); corrientes en un nodo = 0 (KCL).
6) Potencias y balance: $\sum P_{\text{fuentes}} = \sum P_{\text{resistencias}}$.

Esquema (ejemplo de formato):
```
   +--- R1 ---+--- R2 ---+
   |          |          |
  Vs         R3         GND
   |          |          |
   +----------+----------+
```

Enunciado:
"""
[problema]
"""
```

---

### Plantilla — divisor de tensión / corriente

```text
Divisor de tensión: dos o más R en serie con fuente Vs.
$V_{R_k} = Vs \cdot \dfrac{R_k}{R_1+R_2+\cdots}$

Divisor de corriente: R en paralelo con fuente de corriente Is.
$I_{R_k} = Is \cdot \dfrac{G_k}{G_1+G_2+\cdots}$ con $G=1/R$.

Calcula lo pedido y verifica con Ohm.
```

---

### Plantilla — RC transitorio simple (carga/descarga)

```text
Circuito RC de primer orden (una C, Thévenin resistivo visto desde C).

1) Encuentra R_th vista desde el condensador (fuentes apagadas: V→cortocircuito, I→abierto).
2) Constante de tiempo $\tau = R_{th} C$.
3) Condición inicial $v_C(0)$ y valor final $v_C(\infty)$.
4) $v_C(t) = v_C(\infty) + \big(v_C(0)-v_C(\infty)\big)e^{-t/\tau}$
5) $i_C = C \dfrac{dv_C}{dt}$ si se pide.

g = no aplica; usa unidades coherentes (Ω, F, s → τ en segundos).
```

---

### Simulación numérica en Python (sandbox del agente)

Pide al modelo que genere código ejecutable, por ejemplo:

```text
Genera un script Python (solo biblioteca estándar o numpy si está disponible en Pyodide)
que simule el circuito RC: Vs=5 V, R=1e3 Ω, C=1e-6 F, vC(0)=0.
Integra dv/dt = (Vs - v)/ (R*C) con Euler o lista de tiempos 0…5τ.
Imprime t, vC y al final τ y vC(∞).
Todo en un único bloque ```python```.
```

Esquema mínimo de referencia (Euler):

```python
Vs, R, C = 5.0, 1e3, 1e-6
tau = R * C
dt, t_end = tau / 100, 5 * tau
v, t = 0.0, 0.0
while t <= t_end:
    print(f"{t:.6e} {v:.6f}")
    v += dt * (Vs - v) / (R * C)
    t += dt
print("tau =", tau, "Vinf =", Vs)
```

Para DC solo resistivo, mejor **análisis algebraico** (sistema lineal) que “simular” en el tiempo.

---

### Variante corta

```text
Circuito: Vs=12 V en serie con R1=2 kΩ y el paralelo de R2=3 kΩ y R3=6 kΩ.
a) R eq  b) I total  c) I en R2 y R3  d) potencia en R1.
Método: reducción serie/paralelo. g no aplica. Resultados con 3 cifras significativas.
```

---

### Con figura (multimodal)

```text
Lee el esquema adjunto: identifica fuentes, resistencias y conexiones.
Lista la topología (serie/paralelo/puente). Luego aplica la plantilla DC resistivo.
Si un valor no se lee bien, indícalo.
```

---

Con esto puedes alternar: **análisis a mano guiado por el LLM** o **script Python** en el sandbox. Si quieres el siguiente bloque de plantillas (mallas, nodos, o puentes de Wheatstone), dímelo.

---
