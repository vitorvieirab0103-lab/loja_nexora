
// ========================================
// CONFIGURAÇÕES
// ========================================

const API_URL = "https://dummyjson.com/products?limit=100";

let produtos = [];
let carrinho = JSON.parse(localStorage.getItem("nexora-cart")) || [];
let favoritos = JSON.parse(localStorage.getItem("nexora-favorites")) || [];

let categoriaSelecionada = "all";
let mostrandoFavoritos = false;


// ========================================
// ELEMENTOS HTML
// ========================================

const productsGrid = document.getElementById("productsGrid");
const categoriesContainer = document.getElementById("categories");

const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const suggestionsBox = document.getElementById("searchSuggestions");
const searchButton = document.getElementById("searchButton");
const resultsCount = document.getElementById("resultsCount");

const cartCount = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");

const cartSidebar = document.getElementById("cartSidebar");
const overlay = document.getElementById("overlay");

const toast = document.getElementById("toast");

const productModal = document.getElementById("productModal");
const modalDetails = document.getElementById("modalDetails");


// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escaparHTML(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function nomeCategoria(categoria) {
    return categoria
        .replace(/-/g, " ")
        .replace(/\b\w/g, letra => letra.toUpperCase());
}


// ========================================
// BUSCAR PRODUTOS NA API
// ========================================

async function buscarProdutos() {

    try {

        const resposta = await fetch(API_URL);

        if (!resposta.ok) {
            throw new Error("Não foi possível buscar os produtos.");
        }

        const dados = await resposta.json();

        produtos = dados.products;

        criarCategorias();

        atualizarProdutos();

        atualizarCarrinho();

    } catch (erro) {

        console.error(erro);

        productsGrid.innerHTML = `
            <div class="no-products">
                <h3>Ops! Algo deu errado.</h3>
                <p>Não conseguimos carregar os produtos.</p>
                <button onclick="buscarProdutos()">Tentar novamente</button>
            </div>
        `;

        resultsCount.textContent = "Erro ao carregar produtos.";

    }

}


// ========================================
// CRIAR CATEGORIAS
// ========================================

function criarCategorias() {

    const categorias = [
        ...new Set(produtos.map(produto => produto.category))
    ];

    categoriesContainer.innerHTML = `
        <button class="category-button selected" data-category="all">
            Todos
        </button>
    `;

    categorias.forEach(categoria => {

        const botao = document.createElement("button");

        botao.classList.add("category-button");

        botao.dataset.category = categoria;

        botao.textContent = nomeCategoria(categoria);

        categoriesContainer.appendChild(botao);

    });

}


// ========================================
// MOSTRAR PRODUTOS
// ========================================

function atualizarProdutos() {

    let produtosFiltrados = [...produtos];

    // FILTRAR POR CATEGORIA

    if (categoriaSelecionada !== "all") {

        produtosFiltrados = produtosFiltrados.filter(produto =>
            produto.category === categoriaSelecionada
        );

    }

    // FILTRAR POR PESQUISA

    const pesquisa = searchInput.value.toLowerCase().trim();

    if (pesquisa) {

        produtosFiltrados = produtosFiltrados.filter(produto =>
            produto.title.toLowerCase().includes(pesquisa) ||
            produto.category.toLowerCase().includes(pesquisa) ||
            produto.description.toLowerCase().includes(pesquisa)
        );

    }

    // FILTRAR FAVORITOS

    if (mostrandoFavoritos) {

        produtosFiltrados = produtosFiltrados.filter(produto =>
            favoritos.includes(produto.id)
        );

    }

    // ORDENAÇÃO

    const ordenacao = sortSelect.value;

    if (ordenacao === "price-asc") {

        produtosFiltrados.sort((a, b) => a.price - b.price);

    } else if (ordenacao === "price-desc") {

        produtosFiltrados.sort((a, b) => b.price - a.price);

    } else if (ordenacao === "rating") {

        produtosFiltrados.sort((a, b) => b.rating - a.rating);

    }

    // CONTADOR

    resultsCount.textContent =
        `${produtosFiltrados.length} produto(s) encontrado(s)`;

    // VERIFICAR SE EXISTEM PRODUTOS

    if (produtosFiltrados.length === 0) {

        productsGrid.innerHTML = `
            <div class="no-products">
                <h3>Nenhum produto encontrado.</h3>
                <p>Tente pesquisar por outro termo.</p>
            </div>
        `;

        return;

    }

    // RENDERIZAR PRODUTOS

    productsGrid.innerHTML = produtosFiltrados.map(produto => {

        const favorito = favoritos.includes(produto.id);

        return `

            <article class="product-card">

                <div
                    class="product-image"
                    onclick="abrirDetalhes(${produto.id})"
                >

                    <img
                        src="${escaparHTML(produto.thumbnail)}"
                        alt="${escaparHTML(produto.title)}"
                        loading="lazy"
                    >

                    <button
                        class="favorite-product ${favorito ? "active" : ""}"
                        onclick="event.stopPropagation(); alternarFavorito(${produto.id})"
                        aria-label="Adicionar aos favoritos"
                    >
                        ${favorito ? "♥" : "♡"}
                    </button>

                </div>

                <div class="product-info">

                    <span class="product-category">
                        ${escaparHTML(nomeCategoria(produto.category))}
                    </span>

                    <h3
                        onclick="abrirDetalhes(${produto.id})"
                        style="cursor: pointer"
                    >
                        ${escaparHTML(produto.title)}
                    </h3>

                    <div class="product-rating">
                        ★ ${produto.rating.toFixed(1)}
                        <span>(${produto.reviews.length} avaliações)</span>
                    </div>

                    <div class="product-bottom">

                        <span class="product-price">
                            ${formatarPreco(produto.price)}
                        </span>

                        <button
                            class="add-cart"
                            onclick="adicionarCarrinho(${produto.id})"
                            aria-label="Adicionar ao carrinho"
                        >
                            +
                        </button>

                    </div>

                </div>

            </article>

        `;

    }).join("");

}


// ========================================
// FILTROS E PESQUISA
// ========================================

// ========================================
// RESULTADOS AUTOMÁTICOS DA PESQUISA
// ========================================

function atualizarSugestoes() {

    const pesquisa = searchInput.value
        .toLowerCase()
        .trim();

    suggestionsBox.innerHTML = "";

    // Se o campo estiver vazio, esconder resultados
    if (!pesquisa) {
        suggestionsBox.classList.remove("active");
        return;
    }

    // Remover acentos para facilitar a pesquisa
    const normalizar = texto => texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // Procurar produtos reais da API
    const encontrados = produtos.filter(produto => {

        return (
            normalizar(produto.title).includes(normalizar(pesquisa)) ||
            normalizar(produto.category).includes(normalizar(pesquisa)) ||
            normalizar(produto.description).includes(normalizar(pesquisa))
        );

    });

    // Nenhum produto encontrado
    if (encontrados.length === 0) {

        suggestionsBox.innerHTML = `
            <div class="suggestion-empty">
                Nenhum produto encontrado para "${escaparHTML(pesquisa)}".
            </div>
        `;

        suggestionsBox.classList.add("active");
        return;
    }

    // Mostrar no máximo 5 resultados
    const resultados = encontrados.slice(0, 5);

    suggestionsBox.innerHTML = resultados.map(produto => `

        <button
            type="button"
            class="suggestion-item"
            data-product-id="${produto.id}"
        >

            <img
                src="${escaparHTML(produto.thumbnail)}"
                alt="${escaparHTML(produto.title)}"
            >

            <div class="suggestion-info">

                <h4>${escaparHTML(produto.title)}</h4>

                <span>${formatarPreco(produto.price)}</span>

            </div>

        </button>

    `).join("");

    suggestionsBox.classList.add("active");
}


// Atualizar resultados enquanto digita
searchInput.addEventListener("input", atualizarSugestoes);


// Clicar em um resultado
suggestionsBox.addEventListener("click", evento => {

    const resultado = evento.target.closest(".suggestion-item");

    if (!resultado) return;

    const id = Number(resultado.dataset.productId);

    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    searchInput.value = produto.title;

    suggestionsBox.classList.remove("active");

    atualizarProdutos();

    abrirDetalhes(id);

});


// Fechar resultados ao clicar fora
document.addEventListener("click", evento => {

    if (!evento.target.closest(".search-box")) {
        suggestionsBox.classList.remove("active");
    }

});


// Botão buscar
searchButton.addEventListener("click", () => {

    suggestionsBox.classList.remove("active");

    atualizarProdutos();

    document.getElementById("produtos").scrollIntoView({
        behavior: "smooth"
    });

});


// Pesquisar pressionando Enter
searchInput.addEventListener("keydown", evento => {

    if (evento.key === "Enter") {

        suggestionsBox.classList.remove("active");

        atualizarProdutos();

        document.getElementById("produtos").scrollIntoView({
            behavior: "smooth"
        });

    }

});

categoriesContainer.addEventListener("click", evento => {

    const botao = evento.target.closest(".category-button");

    if (!botao) return;

    categoriaSelecionada = botao.dataset.category;

    document.querySelectorAll(".category-button").forEach(item => {
        item.classList.remove("selected");
    });

    botao.classList.add("selected");

    atualizarProdutos();

});


searchInput.addEventListener("input", atualizarProdutos);

sortSelect.addEventListener("change", atualizarProdutos);


// ========================================
// FAVORITOS
// ========================================

function alternarFavorito(id) {

    if (favoritos.includes(id)) {

        favoritos = favoritos.filter(item => item !== id);

        mostrarNotificacao("Produto removido dos favoritos.");

    } else {

        favoritos.push(id);

        mostrarNotificacao("Produto adicionado aos favoritos!");

    }

    localStorage.setItem("nexora-favorites", JSON.stringify(favoritos));

    atualizarProdutos();

}


document.getElementById("favoriteButton").addEventListener("click", () => {

    mostrandoFavoritos = !mostrandoFavoritos;

    const botao = document.getElementById("favoriteButton");

    botao.style.color = mostrandoFavoritos ? "#EF4444" : "";

    if (mostrandoFavoritos) {

        document.getElementById("produtos").scrollIntoView({
            behavior: "smooth"
        });

        resultsCount.textContent = "Seus produtos favoritos";

    }

    atualizarProdutos();

});


// ========================================
// ADICIONAR AO CARRINHO
// ========================================

function adicionarCarrinho(id) {

    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    carrinho.push(produto);

    localStorage.setItem("nexora-cart", JSON.stringify(carrinho));

    atualizarCarrinho();

    mostrarNotificacao("Produto adicionado ao carrinho!");

}


// ========================================
// REMOVER DO CARRINHO
// ========================================

function removerCarrinho(index) {

    carrinho.splice(index, 1);

    localStorage.setItem("nexora-cart", JSON.stringify(carrinho));

    atualizarCarrinho();

}


// ========================================
// ATUALIZAR CARRINHO
// ========================================

function atualizarCarrinho() {

    cartCount.textContent = carrinho.length;

    const total = carrinho.reduce((soma, produto) => {
        return soma + produto.price;
    }, 0);

    cartTotal.textContent = formatarPreco(total);

    if (carrinho.length === 0) {

        cartItems.innerHTML = `
            <p class="empty-cart">
                Seu carrinho está vazio.
            </p>
        `;

        return;

    }

    cartItems.innerHTML = carrinho.map((produto, index) => `

        <div class="cart-item">

            <img
                src="${escaparHTML(produto.thumbnail)}"
                alt="${escaparHTML(produto.title)}"
            >

            <div class="cart-item-info">

                <h4>${escaparHTML(produto.title)}</h4>

                <p>${formatarPreco(produto.price)}</p>

            </div>

            <button
                class="remove-item"
                onclick="removerCarrinho(${index})"
            >
                Remover
            </button>

        </div>

    `).join("");

}


// ========================================
// ABRIR E FECHAR CARRINHO
// ========================================

function abrirCarrinho() {

    cartSidebar.classList.add("active");

    overlay.classList.add("active");

}

function fecharCarrinho() {

    cartSidebar.classList.remove("active");

    overlay.classList.remove("active");

}

document.getElementById("openCart").addEventListener("click", abrirCarrinho);

document.getElementById("closeCart").addEventListener("click", fecharCarrinho);

overlay.addEventListener("click", fecharCarrinho);


// ========================================
// DETALHES DO PRODUTO
// ========================================

function abrirDetalhes(id) {

    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    modalDetails.innerHTML = `

        <div class="modal-product">

            <img
                src="${escaparHTML(produto.thumbnail)}"
                alt="${escaparHTML(produto.title)}"
            >

            <div>

                <span class="product-category">
                    ${escaparHTML(nomeCategoria(produto.category))}
                </span>

                <h2>${escaparHTML(produto.title)}</h2>

                <div class="product-rating">
                    ★ ${produto.rating.toFixed(1)}
                </div>

                <p>${escaparHTML(produto.description)}</p>

                <strong>${formatarPreco(produto.price)}</strong>

                <button
                    class="modal-add"
                    onclick="adicionarCarrinho(${produto.id}); fecharModal()"
                >
                    Adicionar ao carrinho
                </button>

            </div>

        </div>

    `;

    productModal.classList.add("active");

}


function fecharModal() {

    productModal.classList.remove("active");

}

document.getElementById("closeModal").addEventListener("click", fecharModal);

productModal.addEventListener("click", evento => {

    if (evento.target === productModal) {
        fecharModal();
    }

});


// ========================================
// FINALIZAR COMPRA (DEMONSTRATIVO)
// ========================================

document.getElementById("checkoutButton").addEventListener("click", () => {

    if (carrinho.length === 0) {

        mostrarNotificacao("Seu carrinho está vazio!");

        return;

    }

    alert(
        "Esta é uma loja demonstrativa!\n\n" +
        "Total da compra: " + cartTotal.textContent
    );

});


// ========================================
// NOTIFICAÇÕES
// ========================================

function mostrarNotificacao(mensagem) {

    toast.textContent = mensagem;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}


// ========================================
// INICIALIZAR LOJA
// ========================================

buscarProdutos();
