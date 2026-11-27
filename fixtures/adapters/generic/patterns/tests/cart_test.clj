(ns shop.cart-test
  (:require [clojure.test :refer [deftest is]]
            [shop.cart :as cart]))

(deftest adds-an-item (is (= 1 (count (cart/add (cart/empty-cart) "backpack" 1)))))

(deftest clears-the-cart
  (let [cleared (cart/clear (cart/add (cart/empty-cart) "backpack" 1))]
    (println cleared)))

(deftest totals-the-cart
  (is (= 29.99 (cart/total (cart/add (cart/empty-cart) "backpack" 1)))))
