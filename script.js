const avatar = document.querySelector(".avatar");

const fundo = avatar.querySelector("rect");
const linhas = avatar.querySelectorAll("circle, path");

avatar.addEventListener("mouseenter", () => {
  fundo.setAttribute("fill", "#ffffff");

  linhas.forEach((linha) => {
    linha.setAttribute("stroke", "#ea580c");
  });
});

avatar.addEventListener("mouseleave", () => {
  fundo.setAttribute("fill", "#ea580c");

  linhas.forEach((linha) => {
    linha.setAttribute("stroke", "#ffffff");
  });
});
