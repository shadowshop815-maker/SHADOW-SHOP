import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { PageHead, Loading, ErrorState, Empty, StatusBadge, Pager, Pagination } from "../../components/ui";

export type Inventory = { id: string; name: string; sku: string; stock: number; lowStockThreshold: number; status: string; updatedAt: string };

export function Inventory() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [low, setLow] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", page, low],
    queryFn: () => api<{ items: Inventory[]; pagination: Pagination }>(`/admin/inventory?page=${page}&low=${low}`)
  });
  
  const adjust = useMutation({
    mutationFn: ({ id, mode, quantity }: { id: string; mode: string; quantity: number }) => api(`/admin/inventory/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ mode, quantity, reason: "Control center adjustment" })
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["inventory"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  });
  
  const change = (item: Inventory, mode: string) => {
    const raw = prompt(mode === "SET" ? `Set exact stock for ${item.name}` : `Quantity to ${mode.toLowerCase()}`);
    if (raw !== null && Number.isInteger(Number(raw)) && Number(raw) >= 0) {
      adjust.mutate({ id: item.id, mode, quantity: Number(raw) });
    }
  };
  
  return (
    <>
      <PageHead eyebrow="CATALOG" title="Inventory" description="Stock updates are validated and recorded in movement history." />
      <div className="toolbar">
        <button 
          className={low ? "active" : ""} 
          onClick={() => setLow(!low)}
        >
          {low ? "Showing low stock only" : "Show low stock only"}
        </button>
      </div>
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.items.length ? <Empty /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Threshold</th>
                    <th>Status</th>
                    <th>Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(i => (
                    <tr key={i.id}>
                      <td><b>{i.name}</b></td>
                      <td>{i.sku}</td>
                      <td className={i.stock <= i.lowStockThreshold ? "attention" : ""}>{i.stock}</td>
                      <td>{i.lowStockThreshold}</td>
                      <td><StatusBadge value={i.status} /></td>
                      <td className="row-actions">
                        <button onClick={() => change(i, "ADD")}>+ Add</button>
                        <button onClick={() => change(i, "REDUCE")}>− Reduce</button>
                        <button onClick={() => change(i, "SET")}>Set</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager value={data.pagination} onChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
