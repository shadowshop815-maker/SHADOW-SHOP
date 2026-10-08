import { useQuery } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../../api";
import { Spinner, Status } from "../../components/ui";

export function Updates({ media = false }: { media?: boolean }) { 
  const { data, isLoading, error } = useQuery({
    queryKey: ["content", media ? "media" : "updates"],
    queryFn: () => api<any[]>(media ? "/media" : "/updates")
  }); 
  
  if (isLoading) return <Spinner/>; 
  
  return (
    <section className="section page">
      <div className="page-title">
        <span className="eyebrow">{media ? "GALLERY" : "NEWS & UPDATES"}</span>
        <h1>{media ? "Media" : "Updates"}</h1>
      </div>
      <Status error={error} empty={!data?.length}>
        {media ? (
          <div className="media-grid">
            {data?.map(item => (
              <article key={item.id} className="media-item">
                {item.type === "VIDEO" ? (
                  <video src={resolveImageUrl(item.url)} controls preload="none"/>
                ) : (
                  <img src={resolveImageUrl(item.url)} alt=""/>
                )}
                {item.title && <h3>{item.title}</h3>}
              </article>
            ))}
          </div>
        ) : (
          <div className="update-list">
            {data?.map(item => (
              <article className="update-article" key={item.id}>
                {item.coverImage && <img src={resolveImageUrl(item.coverImage)} alt=""/>}
                <div className="update-content">
                  <time>{new Date(item.publishDate).toLocaleDateString()}</time>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  {item.content && <div className="prose" dangerouslySetInnerHTML={{ __html: item.content }}/>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Status>
    </section>
  ); 
}
