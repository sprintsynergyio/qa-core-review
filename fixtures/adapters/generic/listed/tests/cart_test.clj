(ns shop.cart-test
  (:require [clojure.test :refer [deftest is]]
            [shop.cart :as cart]))

(deftest adds-an-item
  (is (= 1 (count (cart/add (cart/empty-cart) "backpack" 1)))))
