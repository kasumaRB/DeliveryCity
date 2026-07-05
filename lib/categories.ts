// Categorias padrão (fallback). A fonte real fica em platform_settings (gerenciada pelo admin).
// Se o banco não tiver listas configuradas, o app usa estas.

export const DEFAULT_PRODUCT_CATEGORIES: string[] = [
  // Lanches & Salgados
  'Lanche', 'Hambúrguer', 'Cachorro-quente', 'Pizza', 'Pastel', 'Coxinha', 'Esfiha',
  'Salgado', 'Tapioca', 'Crepe', 'Sanduíche', 'Batata Frita',
  // Pratos & Refeições
  'Marmita', 'Prato Feito', 'Refeição Executiva', 'Feijoada', 'Churrasco', 'Espetinho',
  'Massas', 'Lasanha', 'Risoto', 'Strogonoff', 'Parmegiana', 'Sopa / Caldo', 'Salada', 'Grelhados',
  // Culinárias
  'Brasileira', 'Mineira', 'Nordestina', 'Italiana', 'Japonesa', 'Chinesa', 'Árabe',
  'Mexicana', 'Portuguesa', 'Vegetariana', 'Vegana', 'Saudável / Fitness',
  // Frutos do Mar & Oriental
  'Frutos do Mar', 'Peixe', 'Camarão', 'Sushi', 'Temaki', 'Yakisoba',
  // Doces & Sobremesas
  'Açaí', 'Sorvete', 'Sobremesa', 'Bolo', 'Torta', 'Doces', 'Brigadeiro', 'Pudim',
  'Milkshake', 'Pão de Queijo', 'Padaria', 'Café da Manhã',
  // Bebidas
  'Bebida', 'Suco', 'Vitamina', 'Refrigerante', 'Água', 'Cerveja', 'Drinks', 'Café',
  // Outros
  'Porção', 'Petisco', 'Combo', 'Kids', 'Outro',
];

export const DEFAULT_STORE_CATEGORIES: string[] = [
  'Lanche', 'Pizza', 'Hambúrguer', 'Açaí', 'Sorvete', 'Japonesa', 'Chinesa', 'Mexicana',
  'Italiana', 'Árabe', 'Brasileira', 'Mineira', 'Nordestina', 'Marmita', 'Padaria',
  'Doceria', 'Saudável', 'Vegetariana', 'Frutos do Mar', 'Bebidas', 'Outro',
];
