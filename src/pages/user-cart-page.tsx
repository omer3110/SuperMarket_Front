import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cartService } from "@/services/carts.service";
import { useAuth } from "@/providers/auth-provider";
import CopyCartDialog from "@/components/general/copy-cart-alert-dialog";
import { userService } from "@/services/user-service";
import { generateTodoCart } from "@/utils/sockets";
import { socketService } from "@/services/sockets";

interface CartItem {
  productId: string;
  productPrices: { brandName: string; price: number }[];
  name: string;
  quantity: number;
}

interface UserCart {
  id: string;
  name: string;
  items: CartItem[];
}

const UserCartsPage: React.FC = () => {
  const { loggedInUser } = useAuth();
  const [userCarts, setUserCarts] = useState<UserCart[]>([]);
  const [collaboratorCarts, setCollaboratorCarts] = useState<UserCart[]>([]);
  const [collaboratorInputVisible, setCollaboratorInputVisible] = useState<{
    [key: string]: boolean;
  }>({});
  const [collaboratorUsername, setCollaboratorUsername] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    fetchCarts();
    fetchCollaboratorCarts();
  }, []);

  const fetchCarts = async () => {
    try {
      const carts = await cartService.fetchUserCarts();
      setUserCarts(
        carts.map((cart: any) => ({
          id: cart._id,
          name: cart.name,
          items: cart.cartProducts.map((item: any) => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity,
            productPrices: item.productPrices,
          })),
        }))
      );
    } catch (error) {
      console.error("Failed to fetch user carts:", error);
    }
  };

  const fetchCollaboratorCarts = async () => {
    try {
      const collaboratorCarts = await cartService.fetchCollaboratorCarts();
      setCollaboratorCarts(
        collaboratorCarts.map((cart: any) => ({
          id: cart._id,
          name: cart.name,
          items: cart.cartProducts.map((item: any) => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity,
            productPrices: item.productPrices,
          })),
        }))
      );
    } catch (error) {
      console.error("Failed to fetch collaborator carts:", error);
    }
  };

  const handleCopy = async (cartId: string) => {
    if (!loggedInUser) {
      console.error("User is not logged in");
      return;
    }
    const userHasCurrentCart = loggedInUser?.currentCart?.length > 0;
    const selectedCart = userCarts.find((cart) => cart.id === cartId);

    const onConfirm = async () => {
      try {
        if (userHasCurrentCart) {
          await userService.clearCurrentCart();
        }
        if (selectedCart) {
          for (const item of selectedCart.items) {
            await userService.addProductToCurrentCart(
              item.productId,
              item.name,
              item.quantity,
              item.productPrices
            );
          }
        }
        console.log(`Cart with ID: ${cartId} copied to the current cart.`);
      } catch (error) {
        console.error(`Failed to copy cart with ID: ${cartId}`, error);
      }
    };

    if (selectedCart) {
      await onConfirm();
    } else {
      console.error("Selected cart not found");
    }
  };

  const handleLiveMode = async (cartId: string) => {
    if (!loggedInUser) {
      console.error("User is not logged in");
      return;
    }
    const todoCart = await generateTodoCart(loggedInUser);
    await socketService.createRoom(todoCart);
  };

  const handleAddCollaboratorClick = (cartId: string) => {
    setCollaboratorInputVisible((prevState) => ({
      ...prevState,
      [cartId]: true,
    }));
  };

  const handleCancelAddCollaborator = (cartId: string) => {
    setCollaboratorInputVisible((prevState) => ({
      ...prevState,
      [cartId]: false,
    }));
    setCollaboratorUsername((prevState) => ({
      ...prevState,
      [cartId]: "",
    }));
  };

  const handleSaveCollaborator = async (cartId: string) => {
    const username = collaboratorUsername[cartId];
    if (username) {
      try {
        await cartService.addCollaborator(cartId, {
          collaboratorUsername: username,
        });
        setCollaboratorInputVisible((prevState) => ({
          ...prevState,
          [cartId]: false,
        }));
        setCollaboratorUsername((prevState) => ({
          ...prevState,
          [cartId]: "",
        }));
        console.log(`Collaborator ${username} added to cart ID: ${cartId}`);
      } catch (error) {
        console.error(
          `Failed to add collaborator to cart ID: ${cartId}`,
          error
        );
      }
    }
  };

  return (
    <main className="py-12 px-4 sm:px-8 md:px-16 lg:px-32">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold mb-6">My Saved Carts</h1>

        <Accordion type="single" collapsible className="w-full max-w-3xl">
          {userCarts.map((cart) => (
            <AccordionItem key={cart.id} value={cart.id}>
              <AccordionTrigger>{cart.name}</AccordionTrigger>
              <AccordionContent>
                <ul className="mb-4">
                  {cart.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between py-2">
                      <span>{item.name}</span>
                      <span>x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-4">
                  <CopyCartDialog
                    cartId={cart.id}
                    userHasCurrentCart={loggedInUser?.currentCart?.length > 0}
                    onConfirm={() => handleCopy(cart.id)}
                  />
                  <Button onClick={() => handleLiveMode(cart.id)}>
                    Live Mode
                  </Button>
                  <Button onClick={() => handleAddCollaboratorClick(cart.id)}>
                    Add Collaborator
                  </Button>
                </div>
                {collaboratorInputVisible[cart.id] && (
                  <div className="m-4">
                    <Input
                      type="text"
                      placeholder="Enter collaborator username"
                      value={collaboratorUsername[cart.id] || ""}
                      onChange={(e) =>
                        setCollaboratorUsername((prevState) => ({
                          ...prevState,
                          [cart.id]: e.target.value,
                        }))
                      }
                      className="mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => handleCancelAddCollaborator(cart.id)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={() => handleSaveCollaborator(cart.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}

          {collaboratorCarts.length > 0 && (
            <>
              <h2 className="text-2xl font-bold mb-4 mt-6">
                Collaborator Carts
              </h2>
              {collaboratorCarts.map((cart) => (
                <AccordionItem key={cart.id} value={cart.id}>
                  <AccordionTrigger>{cart.name}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="mb-4">
                      {cart.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between py-2">
                          <span>{item.name}</span>
                          <span>x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end gap-4">
                      <CopyCartDialog
                        cartId={cart.id}
                        userHasCurrentCart={
                          loggedInUser?.currentCart?.length > 0
                        }
                        onConfirm={() => handleCopy(cart.id)}
                      />
                      <Button onClick={() => handleLiveMode(cart.id)}>
                        Live Mode
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </>
          )}
        </Accordion>
      </div>
    </main>
  );
};

export default UserCartsPage;
