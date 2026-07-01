import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const meta = () => {
  return [{ title: "DASHBOARD" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  return json({});
};

/*==============================| Action Function |==============================*/
export const action: ActionFunction = async ({ request }) => {
  //=============| Datos del POST |==============================//
  const formData = await request.formData();
  const { action, payload } = Object.fromEntries(formData);

  return json({
    errorMs: "Ocurrió un error al cargar la pagina",
  });
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks...
  const fetcher = useFetcher();

  // Estados de la pagina
  const [loadingPets, setLoadingPets] = useState(true);

  /*------------------------------CARGA DE CATÁLOGOS------------------------------*/
  useEffect(() => {
    fetcher.submit(
      {
        action: "loadInformation",
      },
      { method: "post" },
    );
  }, []);

  /*------------------------------SETEO DE DATOS PROVENIENTES DEL POST------------------------------*/
  useEffect(() => {
    // Mensaje de error durante algun proceso
    if (fetcher.data?.errorMsg) {
      toast.error(fetcher.data.errorMsg);
      setLoadingPets(false);
    }
  }, [fetcher.data]);

  /*------------------------------EFECTOS------------------------------*/

  /*------------------------------FUNCIONES------------------------------*/

  return <div className=""></div>;
}
