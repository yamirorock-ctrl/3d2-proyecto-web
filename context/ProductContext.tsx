import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product } from '../types';
import { getAllProducts, upsertProduct, deleteProduct } from '../services/productService';

// Updated Product Data for 3D Printing and Laser Cutting
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Dinosaurio Articulado T-Rex",
    price: 15.00,
    category: "Juguetes 3D",
    image: "https://images.unsplash.com/photo-1603665230139-143054c5e8b9?auto=format&fit=crop&q=80&w=800", // Toy placeholder
    description: "Figura de acción articulada flexible, impresa en PLA biodegradable de alta calidad. Varios colores."
  },
  {
    id: 2,
    name: "Caja de Té Mandala",
    price: 28.50,
    category: "Corte Láser",
    image: "https://images.unsplash.com/photo-1516916759473-600c07bc99d7?auto=format&fit=crop&q=80&w=800", // Box placeholder
    description: "Caja organizadora de madera MDF con diseño calado de mandala. 4 divisiones."
  },
  {
    id: 3,
    name: "Lámpara Luna Litofanía",
    price: 35.00,
    category: "Hogar 3D",
    image: "https://images.unsplash.com/photo-1540932296217-27953f393c72?auto=format&fit=crop&q=80&w=800", // Moon lamp placeholder
    description: "Esfera iluminada con textura realista de la luna. Incluye base de madera y luz LED."
  },
  {
    id: 4,
    name: "Llavero Personalizado Nombre",
    price: 5.99,
    category: "Personalizados",
    image: "https://images.unsplash.com/photo-1632167421267-43003e508546?auto=format&fit=crop&q=80&w=800", // Keychain placeholder
    description: "Llavero impreso en 3D en dos colores a elección. Ideal para souvenirs y regalos."
  },
  {
    id: 5,
    name: "Soporte Celular Geométrico",
    price: 12.00,
    category: "Accesorios",
    image: "https://images.unsplash.com/photo-1586775490184-b79136e26399?auto=format&fit=crop&q=80&w=800", // Phone stand placeholder
    description: "Diseño low-poly moderno, resistente y estilizado para tu escritorio."
  },
  {
    id: 6,
    name: "Topper para Torta 'Feliz Cumple'",
    price: 8.50,
    category: "Eventos",
    image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&q=80&w=800", // Cake decoration placeholder
    description: "Adorno de torta en acrílico dorado o madera, corte láser de precisión."
  },
    {
    id: 7,
    name: "Maceta Baby Groot",
    price: 18.99,
    category: "Hogar 3D",
    image: "https://images.unsplash.com/photo-1520412092553-02dd1792080c?auto=format&fit=crop&q=80&w=800", // Pot placeholder
    description: "La maceta más tierna para tus suculentas. Impresión 3D detallada y pintada a mano."
  },
  {
    id: 8,
    name: "Rompecabezas 3D Madera",
    price: 32.00,
    category: "Juguetes Láser",
    image: "https://images.unsplash.com/photo-1603354350317-6f7aaa5911c5?auto=format&fit=crop&q=80&w=800", // Puzzle placeholder
    description: "Kit para armar vehículos o animales en madera. Diversión educativa sin pegamento."
  }
];

interface ProductContextType {
  products: Product[];
  availableCategories: string[];
  addProduct: (product: Product) => Promise<void>;
  editProduct: (product: Product) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
  updateStock: (id: number, quantity: number) => void;
  refreshProducts: () => Promise<void>;
  loading: boolean;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredProducts: Product[];
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem('products');
      if (raw) return JSON.parse(raw) as Product[];
    } catch (e) {
      // ignore
    }
    return DEFAULT_PRODUCTS;
  });

  const [availableCategories, setAvailableCategories] = useState<string[]>(() => {
    try {
      const fromStorage = localStorage.getItem('categories');
      const extra = fromStorage ? JSON.parse(fromStorage) as string[] : [];
      const fromProducts = Array.from(new Set((JSON.parse(localStorage.getItem('products')||'[]') as Product[]).map(p=>p.category).filter(Boolean)));
      return Array.from(new Set([...fromProducts, ...extra]));
    } catch (e) {
      return [];
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('Destacados');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const filteredProducts = React.useMemo(() => {
    let result = products;

    // Filter by Category
    if (selectedCategory === 'Destacados') {
        result = result.filter(p => !!p.featured);
    } else if (selectedCategory === '__all__') {
        // No filter
    } else if (selectedCategory === '3D') {
        const inferred3D = (p: Product) => (p.category || '').toUpperCase().includes('3D');
        result = result.filter(p => p.technology === '3D' || (!p.technology && inferred3D(p)));
    } else if (selectedCategory === 'Láser') {
        const inferredLaser = (p: Product) => (p.category || '').toLowerCase().includes('láser') || (p.category || '').toLowerCase().includes('laser');
        result = result.filter(p => p.technology === 'Láser' || (!p.technology && inferredLaser(p)));
    } else {
        result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by Search
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(p => 
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        );
    }

    return result;
  }, [products, selectedCategory, searchQuery]);


  const normalizeProducts = (productsFromDB: any[]): Product[] => {
     return productsFromDB.map(p => {
        if (p.images && Array.isArray(p.images)) {
        p.images = p.images.map((img: any) => {
            if (typeof img === 'string') {
            try {
                return JSON.parse(img);
            } catch {
                return img;
            }
            }
            return img;
        });
        }
        return p;
    });
  };

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    try {
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      const key = (import.meta as any).env?.VITE_SUPABASE_ANON_TOKEN;
      if (!url || !key) {
           console.warn('Supabase not configured');
           setLoading(false);
           return;
      }
      
      const productsFromDB = await getAllProducts();
      if (productsFromDB.length > 0) {
        const normalizedProducts = normalizeProducts(productsFromDB);
        setProducts(normalizedProducts);
        
        const remoteCats = Array.from(new Set(normalizedProducts.map(p => p.category).filter(Boolean)));
        const prevCatsRaw = localStorage.getItem('categories');
        const prevCats = prevCatsRaw ? JSON.parse(prevCatsRaw) as string[] : [];
        const merged = Array.from(new Set([...prevCats, ...remoteCats]));
        setAvailableCategories(merged);
      } else {
        console.warn('No products from Supabase, using local.');
      }
    } catch (e) {
      console.warn('Error syncing products:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // Save products to local storage
  useEffect(() => {
    try {
      localStorage.setItem('products', JSON.stringify(products));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('LocalStorage full');
      }
    }
  }, [products]);

  // Save categories to local storage
  useEffect(() => {
    try {
      localStorage.setItem('categories', JSON.stringify(availableCategories));
    } catch (e) {
        // ignore
    }
  }, [availableCategories]);


  const addProduct = async (prod: Product) => {
    const nextId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const newProduct = { ...prod, id: nextId };
    setProducts(prev => [...prev, newProduct]);
    
    const { error } = await upsertProduct(newProduct);
    if (error) console.warn('Supabase error:', error.message);
  };

  const editProduct = async (prod: Product) => {
    setProducts(prev => prev.map(p => p.id === prod.id ? prod : p));
    const { error } = await upsertProduct(prod);
    if (error) console.warn('Supabase error:', error.message);
  };

  const removeProduct = async (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    const { error } = await deleteProduct(id);
    if (error) console.warn('Supabase error:', error.message);
  };

  const updateStock = (id: number, quantity: number) => {
      setProducts(prev => prev.map(product => {
        if (product.id === id && product.stock !== undefined) {
             return {
                ...product,
                stock: Math.max(0, product.stock - quantity)
             };
        }
        return product;
      }));
  };

  return (
    <ProductContext.Provider value={{ 
        products, 
        availableCategories, 
        addProduct, 
        editProduct, 
        removeProduct, 
        updateStock,
        refreshProducts,
        loading 
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
